import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Privilegi minimi di database e archivio (1F-W4 T6g, rilievi R10 e R11 della T4).
 *
 * Avvia database e archivio del Compose di produzione con segreti sintetici, applica le migrazioni e
 * prova **con le credenziali che il Compose dà davvero** ad `api`, `migrate`, `backup` e `restore`
 * (lette da `docker compose config`): l'API non è superutente, il backup legge e non scrive, le
 * tabelle appartengono al proprietario, gli utenti dell'archivio sono limitati ai due bucket.
 * Nessun dato reale. Il progetto è effimero e `afterAll` lo toglie con `down -v`.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const deployDir = path.join(repoRoot, 'infra', 'deploy');
const composeFile = path.join(deployDir, 'compose.yml');
const overrideFile = path.join(import.meta.dirname, 'compose.sicurezza.yml');
const rolesScript = path.join(deployDir, 'db-init', 'roles.sql');
const IMAGE_TAG = process.env.SICUREZZA_IMAGE_TAG ?? 'w4-t7a';
const PROJECT = `amoris-prova-ruoli-${process.pid}`;

const composeText = readFileSync(composeFile, 'utf8');
const imageOf = (pattern: RegExp): string => {
  const found = pattern.exec(composeText)?.[1];
  if (!found) throw new Error(`immagine non trovata nel Compose: ${pattern}`);
  return found;
};
const DB_IMAGE = imageOf(/^\s*image:\s*(postgres:\S+@sha256:[0-9a-f]{64})\s*$/m);
const MC_IMAGE = imageOf(
  /^\s*image:\s*(cgr\.dev\/chainguard\/minio-client@sha256:[0-9a-f]{64})\s*$/m,
);

const workDir = mkdtempSync(path.join(tmpdir(), 'amoris-ruoli-'));
const hex = (bytes: number): string => randomBytes(bytes).toString('hex');
const secrets = {
  postgres: hex(18),
  dbOwner: hex(18),
  dbApp: hex(18),
  dbBackup: hex(18),
  s3Access: hex(10),
  s3Secret: hex(20),
  s3Api: hex(20),
  s3Backup: hex(20),
};

interface Service {
  environment?: Record<string, string>;
  profiles?: string[];
}
interface Config {
  services: Record<string, Service>;
}

let dbPort = 0;
let envFile = '';
let volumesBefore = 0;
let config: Config = { services: {} };

function cleanProcessEnv(): Record<string, string> {
  const drop =
    /^(AMORIS_|IMAGE_|CADDY_|SITE_URL|POSTGRES_|DB_|S3_|BACKUP_|IP_HASH_SALT|CSRF_SECRET|SCRUB_|MEDIA_|LOG_LEVEL|COMPOSE_|SIC_)/i;
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => !drop.test(entry[0]) && entry[1] !== undefined,
    ),
  );
}

function compose(args: string[], timeout = 600_000) {
  return spawnSync(
    'docker',
    [
      'compose',
      '-p',
      PROJECT,
      '-f',
      composeFile,
      '-f',
      overrideFile,
      '--env-file',
      envFile,
      ...args,
    ],
    { cwd: deployDir, env: cleanProcessEnv(), encoding: 'utf8', timeout },
  );
}

function mustCompose(args: string[], timeout?: number): string {
  const result = compose(args, timeout);
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(' ')}: ${result.stderr.slice(-1500)}`);
  }
  return result.stdout;
}

function docker(args: string[], timeout = 180_000) {
  return spawnSync('docker', args, { encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024 });
}

function countVolumes(): number {
  return docker(['volume', 'ls', '-q'], 60_000)
    .stdout.split('\n')
    .filter((line) => line.trim() !== '').length;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

const env = (service: string): Record<string, string> =>
  config.services[service]?.environment ?? {};

/** Collegamento al database dello stack con le credenziali di `DATABASE_URL` del servizio indicato. */
function connect(service: string): { sql: postgres.Sql; user: string } {
  const url = new URL(env(service).DATABASE_URL ?? '');
  url.hostname = '127.0.0.1';
  url.port = String(dbPort);
  return {
    sql: postgres(url.toString(), { max: 1, onnotice: () => undefined, connect_timeout: 20 }),
    user: decodeURIComponent(url.username),
  };
}

/** Collegamento con `PGUSER` e `PGPASSWORD` del servizio indicato (backup, restore). */
function connectPg(service: string): { sql: postgres.Sql; user: string } {
  const { PGUSER = '', PGPASSWORD = '', PGDATABASE = 'amoris' } = env(service);
  return {
    sql: postgres({
      host: '127.0.0.1',
      port: dbPort,
      username: PGUSER,
      password: PGPASSWORD,
      database: PGDATABASE,
      max: 1,
      onnotice: () => undefined,
      connect_timeout: 20,
    }),
    user: PGUSER,
  };
}

/** Esegue uno script di `mc` come l'utente dato, dentro la rete dei dati; restituisce le righe `chiave=codice`. */
function mc(accessKey: string, secretKey: string, script: string): Record<string, string> {
  const result = docker([
    'run',
    '--rm',
    '--network',
    `${PROJECT}_data`,
    '-e',
    `AK=${accessKey}`,
    '-e',
    `SK=${secretKey}`,
    '--entrypoint',
    '/bin/sh',
    MC_IMAGE,
    '-c',
    script,
  ]);
  const codes: Record<string, string> = {};
  for (const line of result.stdout.split('\n')) {
    const match = /^([a-z_]+)=(\d+)$/.exec(line.trim());
    if (match) codes[match[1] ?? ''] = match[2] ?? '';
  }
  return codes;
}

const BUCKET_OTHER = 'bucket-estraneo';

/** Prove di un utente dell'archivio: ogni riga dice il codice d'uscita del comando. */
const MC_PROBE = [
  'mc alias set u http://objects:9000 "$AK" "$SK" >/dev/null 2>&1; echo alias=$?',
  'echo sintetico | mc pipe u/media-public/prova-ruoli.txt >/dev/null 2>&1; echo write_public=$?',
  'echo sintetico | mc pipe u/media-private/prova-ruoli.txt >/dev/null 2>&1; echo write_private=$?',
  'mc cat u/media-public/prova-ruoli.txt >/dev/null 2>&1; echo read_public=$?',
  'mc cat u/media-private/prova-ruoli.txt >/dev/null 2>&1; echo read_private=$?',
  'mc ls u >/dev/null 2>&1; echo list_root=$?',
  'mc ls u/media-public >/dev/null 2>&1; echo list_public=$?',
  'mc rm u/media-public/prova-ruoli.txt >/dev/null 2>&1; echo delete_public=$?',
  'mc rm u/media-private/prova-ruoli.txt >/dev/null 2>&1; echo delete_private=$?',
  'mc mb u/bucket-nuovo-prova >/dev/null 2>&1; echo make_bucket=$?',
  `mc ls u/${BUCKET_OTHER} >/dev/null 2>&1; echo list_other=$?`,
  `echo sintetico | mc pipe u/${BUCKET_OTHER}/x.txt >/dev/null 2>&1; echo write_other=$?`,
  `mc cat u/${BUCKET_OTHER}/seme.txt >/dev/null 2>&1; echo read_other=$?`,
  'mc admin user list u >/dev/null 2>&1; echo admin=$?',
].join('\n');

beforeAll(async () => {
  volumesBefore = countVolumes();
  dbPort = await freePort();
  const objectsPort = await freePort();
  const sshKey = path.join(workDir, 'ssh_key');
  const knownHosts = path.join(workDir, 'known_hosts');
  writeFileSync(sshKey, 'sintetica');
  writeFileSync(knownHosts, 'sintetico');

  envFile = path.join(workDir, 'ambiente.env');
  const values: Record<string, string> = {
    AMORIS_ENV: 'production',
    IMAGE_PREFIX: 'amoris',
    IMAGE_TAG,
    CADDY_SITE_ADDRESS: 'localhost',
    CADDY_HTTP_PORT: '1',
    CADDY_HTTPS_PORT: '2',
    SITE_URL: 'https://localhost',
    POSTGRES_PASSWORD: secrets.postgres,
    DB_OWNER_PASSWORD: secrets.dbOwner,
    DB_APP_PASSWORD: secrets.dbApp,
    DB_BACKUP_PASSWORD: secrets.dbBackup,
    S3_ACCESS_KEY: secrets.s3Access,
    S3_SECRET_KEY: secrets.s3Secret,
    S3_API_SECRET_KEY: secrets.s3Api,
    S3_BACKUP_SECRET_KEY: secrets.s3Backup,
    IP_HASH_SALT: hex(24),
    CSRF_SECRET: hex(24),
    TOTP_ENCRYPTION_KEY: 'cd'.repeat(32),
    SCRUB_SERVICE_TOKEN: hex(24),
    // Obbligatoria dal riesame della T7 (DR-402).
    APP_SUBNET: '10.77.84.0/24',
    RESTIC_PASSWORD: hex(18),
    BACKUP_SFTP_HOST: 'sftp.esempio.invalid',
    BACKUP_SFTP_USER: 'utente',
    BACKUP_SFTP_PATH: 'prova',
    BACKUP_SSH_KEY_PATH: sshKey,
    BACKUP_KNOWN_HOSTS_PATH: knownHosts,
    SIC_DB_PORT: String(dbPort),
    SIC_OBJECTS_PORT: String(objectsPort),
  };
  writeFileSync(
    envFile,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );

  config = JSON.parse(
    mustCompose(
      ['--profile', 'release', '--profile', 'backup', 'config', '--format', 'json'],
      60_000,
    ),
  ) as Config;

  mustCompose(['up', '-d', '--wait', 'db', 'objects']);
  mustCompose(['run', '--rm', 'objects-init']);
  mustCompose(['--profile', 'release', 'run', '--rm', 'migrate']);

  // Un bucket e un oggetto estranei all'applicazione, creati con le credenziali principali.
  const seed = mc(
    secrets.s3Access,
    secrets.s3Secret,
    [
      'mc alias set u http://objects:9000 "$AK" "$SK" >/dev/null 2>&1; echo alias=$?',
      `mc mb u/${BUCKET_OTHER} >/dev/null 2>&1; echo make=$?`,
      `echo seme | mc pipe u/${BUCKET_OTHER}/seme.txt >/dev/null 2>&1; echo put=$?`,
    ].join('\n'),
  );
  expect(seed).toEqual({ alias: '0', make: '0', put: '0' });
}, 1_200_000);

afterAll(() => {
  compose(
    ['--profile', 'release', '--profile', 'backup', 'down', '-v', '--remove-orphans'],
    300_000,
  );
  console.info(`[ruoli-1f] volumi Docker prima: ${volumesBefore}, dopo: ${countVolumes()}`);
  rmSync(workDir, { recursive: true, force: true });
}, 600_000);

const FLAGS = `SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
  FROM pg_roles WHERE rolname = current_user`;

async function expectNoPowers(sql: postgres.Sql): Promise<void> {
  const [flags] = await sql.unsafe(FLAGS);
  expect(flags).toEqual({
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
  });
}

describe('database: ruolo applicativo dell’API', () => {
  it('non è il superutente e non ha nessun potere di amministrazione', async () => {
    const { sql, user } = connect('api');
    try {
      expect(user).not.toBe(env('db').POSTGRES_USER);
      await expectNoPowers(sql);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('non può eseguire programmi, leggere file, creare ruoli o database', async () => {
    const { sql } = connect('api');
    try {
      await expect(sql.unsafe("COPY (SELECT 1) TO PROGRAM 'true'")).rejects.toThrow(
        /permission denied/i,
      );
      await expect(sql.unsafe("COPY forms FROM PROGRAM 'true'")).rejects.toThrow(
        /permission denied/i,
      );
      await expect(sql.unsafe('CREATE ROLE intruso LOGIN')).rejects.toThrow(/permission denied/i);
      await expect(sql.unsafe('CREATE DATABASE intruso')).rejects.toThrow(/permission denied/i);
      await expect(sql.unsafe("SELECT pg_read_file('/etc/passwd')")).rejects.toThrow(
        /permission denied/i,
      );
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('legge e scrive le tabelle dell’applicazione e usa le sequenze', async () => {
    const { sql } = connect('api');
    try {
      const slug = `prova-ruoli-${hex(4)}`;
      await sql`INSERT INTO forms (slug, title, definition, confirmation_message, is_active)
        VALUES (${slug}, 'Prova dei ruoli', ${sql.json({ fields: [] })}, 'Ricevuto', true)`;
      await sql`UPDATE forms SET title = 'Prova dei ruoli, aggiornata' WHERE slug = ${slug}`;
      const rows = await sql`SELECT title FROM forms WHERE slug = ${slug}`;
      expect(rows).toHaveLength(1);
      await sql`DELETE FROM forms WHERE slug = ${slug}`;
      const [missing] = await sql`SELECT count(*)::int AS n FROM pg_class
        WHERE relkind = 'S' AND relnamespace = 'public'::regnamespace
          AND NOT has_sequence_privilege(current_user, oid, 'USAGE')`;
      expect(missing?.n).toBe(0);
      const [tables] = await sql`SELECT count(*)::int AS n FROM pg_tables t
        WHERE schemaname = 'public'
          AND NOT (has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'SELECT')
               AND has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'INSERT')
               AND has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'UPDATE')
               AND has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'DELETE'))`;
      expect(tables?.n).toBe(0);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('non esegue DDL: niente tabelle nuove, niente DROP, niente TRUNCATE', async () => {
    const { sql } = connect('api');
    try {
      await expect(sql.unsafe('CREATE TABLE public.intruso (id int)')).rejects.toThrow(
        /permission denied/i,
      );
      await expect(sql.unsafe('DROP TABLE public.forms')).rejects.toThrow(/must be owner/i);
      await expect(sql.unsafe('TRUNCATE public.forms')).rejects.toThrow(/permission denied/i);
      await expect(sql.unsafe('ALTER TABLE public.forms ADD COLUMN intruso int')).rejects.toThrow(
        /must be owner/i,
      );
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});

describe('database: proprietario delle migrazioni', () => {
  it('migrate usa un ruolo diverso dal superutente e dall’API, e gli oggetti sono suoi', async () => {
    const migrate = connect('migrate');
    const api = connect('api');
    try {
      expect(migrate.user).not.toBe(env('db').POSTGRES_USER);
      expect(migrate.user).not.toBe(api.user);
      await expectNoPowers(migrate.sql);
      const owners = await migrate.sql`SELECT DISTINCT tableowner FROM pg_tables
        WHERE schemaname IN ('public', 'drizzle')`;
      expect(owners.map((row) => row.tableowner)).toEqual([migrate.user]);
    } finally {
      await migrate.sql.end({ timeout: 5 });
      await api.sql.end({ timeout: 5 });
    }
  });

  it('le tabelle create dalle migrazioni future arrivano all’API con i privilegi giusti', async () => {
    const migrate = connect('migrate');
    const api = connect('api');
    try {
      await migrate.sql.unsafe(
        'CREATE TABLE public.prova_privilegi_futuri (id serial PRIMARY KEY, v text)',
      );
      await api.sql`INSERT INTO prova_privilegi_futuri (v) VALUES ('uno')`;
      expect((await api.sql`SELECT v FROM prova_privilegi_futuri`).length).toBe(1);
      await migrate.sql.unsafe('DROP TABLE public.prova_privilegi_futuri');
    } finally {
      await migrate.sql.end({ timeout: 5 });
      await api.sql.end({ timeout: 5 });
    }
  });

  it('il passo di inizializzazione si ripete e riallinea le password', async () => {
    const api = connect('api');
    const admin = postgres({
      host: '127.0.0.1',
      port: dbPort,
      username: env('db').POSTGRES_USER ?? 'amoris',
      password: secrets.postgres,
      database: env('db').POSTGRES_DB ?? 'amoris',
      max: 1,
      onnotice: () => undefined,
    });
    try {
      await admin.unsafe(`ALTER ROLE "${api.user}" PASSWORD 'password-scorretta-di-prova'`);
      mustCompose(['run', '--rm', 'db-init']);
      mustCompose(['run', '--rm', 'db-init']);
      const again = connect('api');
      try {
        await expectNoPowers(again.sql);
      } finally {
        await again.sql.end({ timeout: 5 });
      }
    } finally {
      await admin.end({ timeout: 5 });
      await api.sql.end({ timeout: 5 });
    }
  }, 180_000);
});

describe('database: ruolo di sola lettura del backup', () => {
  it('non è superutente, legge ogni tabella e non scrive', async () => {
    const { sql, user } = connectPg('backup');
    try {
      expect(user).not.toBe(env('db').POSTGRES_USER);
      await expectNoPowers(sql);
      const rows = await sql`SELECT count(*)::int AS n FROM users`;
      expect(rows).toHaveLength(1);
      await expect(
        sql`INSERT INTO forms (slug, title, definition, confirmation_message, is_active)
          VALUES ('intruso', 'x', ${sql.json({ fields: [] })}, 'x', true)`,
      ).rejects.toThrow(/permission denied/i);
      await expect(sql`DELETE FROM forms`).rejects.toThrow(/permission denied/i);
      await expect(sql.unsafe('CREATE TABLE public.intruso (id int)')).rejects.toThrow(
        /permission denied/i,
      );
      await expect(sql.unsafe("COPY (SELECT 1) TO PROGRAM 'true'")).rejects.toThrow(
        /permission denied/i,
      );
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('un pg_dump riesce e il dump si ripristina con il ruolo proprietario, con i privilegi dell’API', () => {
    expect(existsSync(rolesScript)).toBe(true);
    const backup = env('backup');
    const restore = env('restore');
    const superuser = env('db').POSTGRES_USER ?? 'amoris';
    const owner = new URL(env('migrate').DATABASE_URL ?? '');
    const app = new URL(env('api').DATABASE_URL ?? '');
    const script = [
      'set -eu',
      'export PGHOST=db',
      // Dump con il ruolo del backup.
      'PGUSER="$B_USER" PGPASSWORD="$B_PASS" pg_dump --no-password -Fc --compress=0 -d "$DB" -f /tmp/d.dump',
      'test -s /tmp/d.dump; echo dump=0',
      // Database nuovo con le impostazioni dei ruoli, poi ripristino come fa `restore`.
      'PGUSER="$S_USER" PGPASSWORD="$S_PASS" psql --no-password -X -q -v ON_ERROR_STOP=1 -c "CREATE DATABASE ripristino" -d "$DB"',
      'PGUSER="$S_USER" PGPASSWORD="$S_PASS" psql --no-password -X -q -v ON_ERROR_STOP=1 -d ripristino -v owner_pw="$O_PASS" -v app_pw="$A_PASS" -v backup_pw="$B_PASS" -f /init/roles.sql >/dev/null',
      'PGUSER="$R_USER" PGPASSWORD="$R_PASS" pg_restore --no-password --exit-on-error --single-transaction --no-owner --no-privileges -d ripristino /tmp/d.dump; echo restore=$?',
      'PGUSER="$A_USER" PGPASSWORD="$A_PASS" psql --no-password -XAtq -v ON_ERROR_STOP=1 -d ripristino -c "SELECT count(*) FROM forms" >/dev/null; echo app_read=$?',
    ].join('\n');
    const run = docker([
      'run',
      '--rm',
      '--network',
      `${PROJECT}_data`,
      '-v',
      `${rolesScript.replaceAll('\\', '/')}:/init/roles.sql:ro`,
      '-e',
      `DB=${backup.PGDATABASE ?? 'amoris'}`,
      '-e',
      `B_USER=${backup.PGUSER}`,
      '-e',
      `B_PASS=${backup.PGPASSWORD}`,
      '-e',
      `S_USER=${superuser}`,
      '-e',
      `S_PASS=${secrets.postgres}`,
      '-e',
      `O_PASS=${secrets.dbOwner}`,
      '-e',
      `A_PASS=${secrets.dbApp}`,
      '-e',
      `R_USER=${restore.PGUSER}`,
      '-e',
      `R_PASS=${restore.PGPASSWORD}`,
      '-e',
      `A_USER=${decodeURIComponent(app.username)}`,
      '--entrypoint',
      '/bin/sh',
      DB_IMAGE,
      '-c',
      script,
    ]);
    const detail = `${run.stdout}\n${run.stderr}`.replaceAll(/password\S*/gi, '***').slice(-1200);
    expect(run.stdout, detail).toContain('dump=0');
    expect(run.stdout, detail).toContain('restore=0');
    expect(run.stdout, detail).toContain('app_read=0');
    expect(decodeURIComponent(owner.username)).toBe(restore.PGUSER);
  }, 240_000);
});

describe('archivio: utenti di servizio', () => {
  it('l’utente dell’API legge, scrive e cancella nei due bucket e non può altro', () => {
    const { S3_ACCESS_KEY = '', S3_SECRET_KEY = '' } = env('api');
    expect(S3_ACCESS_KEY).not.toBe(secrets.s3Access);
    const r = mc(S3_ACCESS_KEY, S3_SECRET_KEY, MC_PROBE);
    expect(r).toMatchObject({
      alias: '0',
      write_public: '0',
      write_private: '0',
      read_public: '0',
      read_private: '0',
      list_root: '0',
      list_public: '0',
      delete_public: '0',
      delete_private: '0',
    });
    for (const denied of ['make_bucket', 'list_other', 'write_other', 'read_other', 'admin']) {
      expect(r[denied], denied).toBeDefined();
      expect(r[denied], denied).not.toBe('0');
    }
  }, 240_000);

  it('l’utente del backup legge i due bucket e non scrive né cancella', () => {
    const { S3_ACCESS_KEY = '', S3_SECRET_KEY = '' } = env('backup');
    expect(S3_ACCESS_KEY).not.toBe(secrets.s3Access);
    expect(S3_ACCESS_KEY).not.toBe(env('api').S3_ACCESS_KEY);
    // Un oggetto di prova scritto con l'utente dell'API, da leggere con quello del backup.
    const api = env('api');
    mc(
      api.S3_ACCESS_KEY ?? '',
      api.S3_SECRET_KEY ?? '',
      [
        'mc alias set u http://objects:9000 "$AK" "$SK" >/dev/null 2>&1',
        'echo sintetico | mc pipe u/media-public/prova-ruoli.txt >/dev/null 2>&1',
        'echo sintetico | mc pipe u/media-private/prova-ruoli.txt >/dev/null 2>&1',
        'echo fatto=0',
      ].join('\n'),
    );
    const r = mc(S3_ACCESS_KEY, S3_SECRET_KEY, MC_PROBE);
    expect(r).toMatchObject({ alias: '0', read_public: '0', read_private: '0', list_public: '0' });
    for (const denied of [
      'write_public',
      'write_private',
      'delete_public',
      'delete_private',
      'make_bucket',
      'list_other',
      'write_other',
      'read_other',
      'admin',
    ]) {
      expect(r[denied], denied).toBeDefined();
      expect(r[denied], denied).not.toBe('0');
    }
  }, 240_000);
});

describe('credenziali principali: solo a chi le deve avere', () => {
  const roots = (): string[] => [secrets.postgres, secrets.s3Access, secrets.s3Secret];

  it('api, migrate e backup non ricevono né la password del superutente né le chiavi principali di MinIO', () => {
    for (const name of ['api', 'migrate', 'backup', 'restore']) {
      const text = JSON.stringify(env(name));
      expect(Object.keys(env(name)).length, name).toBeGreaterThan(0);
      for (const root of roots()) expect(text, name).not.toContain(root);
    }
  });

  it('il superutente e le chiavi principali stanno solo in db, db-init, objects e objects-init', () => {
    const holders = Object.entries(config.services)
      .filter(([, service]) => {
        const text = JSON.stringify(service.environment ?? {});
        return roots().some((root) => text.includes(root));
      })
      .map(([name]) => name)
      .sort();
    expect(holders).toEqual(['db', 'db-init', 'objects', 'objects-init']);
  });
});
