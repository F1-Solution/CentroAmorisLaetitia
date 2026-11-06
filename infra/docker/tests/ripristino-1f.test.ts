import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Prove del ripristino (1F-W3 T3, criteri W3-6, W3-7, W3-9; DR-366…DR-373, DR-378).
 *
 * Con Docker: stack di origine (database, MinIO, destinazione SFTP di prova) popolato con dati
 * **sintetici**, e uno stack di destinazione nuovo e vuoto (database e MinIO propri, volume dei
 * dati di appoggio proprio). Password e chiavi nascono qui e finiscono in volumi che la prova
 * rimuove. Nessun dato reale, nessun segreto del repository.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const TAG = 'prova-t3';
const IMAGE = `amoris-backup:${TAG}`;
const SFTP_IMAGE = `amoris-sftp-prova:${TAG}`;
const NET = 'amoris-t3-rete';
const C = {
  sftp: 'amoris-t3-sftp',
  db: 'amoris-t3-db',
  objects: 'amoris-t3-objects',
  dbDest: 'amoris-t3-db-dest',
  objectsDest: 'amoris-t3-objects-dest',
};
const V = {
  keys: 'amoris-t3-chiavi',
  dataSrc: 'amoris-t3-dati-origine',
  dataDest: 'amoris-t3-dati-dest',
  state: 'amoris-t3-stato',
  cache: 'amoris-t3-cache',
  objects: 'amoris-t3-oggetti',
  objectsDest: 'amoris-t3-oggetti-dest',
};

const compose = readFileSync(path.join(repoRoot, 'infra', 'deploy', 'compose.yml'), 'utf8');
const composeImage = (pattern: RegExp): string => {
  const found = pattern.exec(compose)?.[1];
  if (!found) throw new Error(`immagine non trovata nel Compose: ${pattern}`);
  return found;
};
const DB_IMAGE = composeImage(/^\s*image:\s*(postgres:\S+@sha256:[0-9a-f]{64})\s*$/m);
const MINIO_IMAGE = composeImage(
  /^\s*image:\s*(cgr\.dev\/chainguard\/minio@sha256:[0-9a-f]{64})\s*$/m,
);

const secret = (): string => randomBytes(18).toString('hex');
const SECRETS = {
  restic: secret(),
  pg: secret(),
  pgLimited: secret(),
  s3Access: `AK${secret()}`.slice(0, 20),
  s3Secret: secret(),
};

/** Dati inventati: se compaiono in un'uscita del contenitore, la prova fallisce. */
const MARK_DB = 'DATO-SINTETICO-RIPRISTINO-9e1b';
const NAME_MARK = 'NOME OGGETTO SINTETICO';
const UNKNOWN_SNAPSHOT = 'f'.repeat(64);

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function docker(args: string[], input?: string): Run {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function dockerBuild(args: string[]): Promise<{ status: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { cwd: repoRoot, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-16_000);
    });
    child.on('error', (error) => resolve({ status: null, stderr: String(error) }));
    child.on('close', (status) => resolve({ status, stderr }));
  });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Ogni uscita dei contenitori di backup e ripristino: serve alla prova finale sui dati che non devono comparire. */
const outputs: string[] = [];
let buildResult: { status: number | null; stderr: string } | undefined;
let sftpBuildResult: { status: number | null; stderr: string } | undefined;

const SOURCE_ENV: Record<string, string> = {
  PGHOST: 'db',
  PGUSER: 'amoris',
  PGDATABASE: 'amoris',
  PGPASSWORD_FILE: '/keys/pg_password',
  S3_ENDPOINT: 'http://objects:9000',
  S3_ACCESS_KEY_FILE: '/keys/s3_access',
  S3_SECRET_KEY_FILE: '/keys/s3_secret',
  S3_BUCKET_PUBLIC: 'media-public',
  S3_BUCKET_PRIVATE: 'media-private',
  RESTIC_PASSWORD_FILE: '/keys/restic_password',
  BACKUP_SFTP_HOST: 'sftp',
  BACKUP_SFTP_PORT: '2222',
  BACKUP_SFTP_USER: 'sftpuser',
  BACKUP_SFTP_PATH: 'repo/amoris',
  BACKUP_SSH_KEY_FILE: '/keys/client_ed25519',
  BACKUP_KNOWN_HOSTS_FILE: '/keys/known_hosts',
  BACKUP_SSH_CONNECT_TIMEOUT: '5',
  PGCONNECT_TIMEOUT: '5',
};
const DEST_ENV: Record<string, string> = {
  ...SOURCE_ENV,
  PGHOST: 'dbd',
  S3_ENDPOINT: 'http://objd:9000',
};

/** Come girerà in produzione: sola lettura, `/tmp` in memoria, nessuna capability, HOME inesistente. */
function runArgs(env: Record<string, string>, dataVolume: string, command: string[]): string[] {
  return [
    'run',
    '--rm',
    '--network',
    NET,
    '--read-only',
    '--tmpfs',
    '/tmp:mode=1777',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--memory',
    '512m',
    '-e',
    'HOME=/nonexistent',
    ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    '-v',
    `${dataVolume}:/backup/data`,
    '-v',
    `${V.state}:/backup/state`,
    '-v',
    `${V.cache}:/backup/cache`,
    '-v',
    `${V.keys}:/keys:ro`,
    IMAGE,
    ...command,
  ];
}

interface Outcome {
  command: string;
  outcome: string;
  started_at: string;
  duration_seconds: number;
  dump_bytes: number | null;
  objects_bytes: number | null;
  objects_count: number | null;
  snapshot_id: string | null;
  failed_step: string | null;
  exit_code: number;
}

function parseLine(run: Run): Outcome {
  const lines = run.stdout.split('\n').filter((line) => line.length > 0);
  return JSON.parse(lines.at(-1) ?? '{}') as Outcome;
}

function backup(): { run: Run; line: Outcome } {
  const run = docker(runArgs(SOURCE_ENV, V.dataSrc, ['amoris-backup', 'backup']));
  outputs.push(`${run.stdout}\n${run.stderr}`);
  return { run, line: parseLine(run) };
}

function restore(
  args: string[],
  overrides: Record<string, string | null> = {},
): { run: Run; line: Outcome } {
  const env: Record<string, string> = { ...DEST_ENV };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete env[key];
    else env[key] = value;
  }
  const run = docker(runArgs(env, V.dataDest, ['amoris-backup', 'restore', ...args]));
  outputs.push(`${run.stdout}\n${run.stderr}`);
  return { run, line: parseLine(run) };
}

function volumeShell(volume: string, script: string): Run {
  return docker([
    'run',
    '--rm',
    '-v',
    `${volume}:/v:ro`,
    '--entrypoint',
    'sh',
    IMAGE,
    '-c',
    script,
  ]);
}

const readStateFile = (file: string): string => volumeShell(V.state, `cat /v/${file}`).stdout;
const listVolume = (volume: string): string => volumeShell(volume, 'ls -A /v').stdout.trim();

function putSecret(name: string, content: string): void {
  const run = docker(
    [
      'run',
      '--rm',
      '-i',
      '--user',
      'root',
      '-v',
      `${V.keys}:/keys`,
      '--entrypoint',
      'sh',
      IMAGE,
      '-c',
      `cat > /keys/${name} && chmod 0444 /keys/${name}`,
    ],
    content,
  );
  if (run.status !== 0) throw new Error(run.stderr);
}

/** Comandi di `mc` contro uno dei due MinIO di prova, con alias `l`. */
function mc(endpoint: string, script: string): Run {
  return docker([
    'run',
    '--rm',
    '--network',
    NET,
    '--tmpfs',
    '/tmp:mode=1777',
    '-e',
    'MC_CONFIG_DIR=/tmp/mc',
    '-e',
    `AK=${SECRETS.s3Access}`,
    '-e',
    `SK=${SECRETS.s3Secret}`,
    '--entrypoint',
    'sh',
    IMAGE,
    '-c',
    `mc alias set l ${endpoint} "$AK" "$SK" >/dev/null && ${script}`,
  ]);
}
const mcSrc = (script: string): Run => mc('http://objects:9000', script);
const mcDest = (script: string): Run => mc('http://objd:9000', script);

function psql(container: string, sql: string, database = 'amoris'): Run {
  return docker(
    [
      'exec',
      '-i',
      '-e',
      `PGPASSWORD=${SECRETS.pg}`,
      container,
      'psql',
      '-h',
      '127.0.0.1',
      '-U',
      'amoris',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-At',
    ],
    sql,
  );
}

/** Righe di ogni tabella (schema.nome|conteggio), nell'ordine dei nomi. */
const TABLE_COUNTS_SQL = `SELECT table_schema || '.' || table_name || '|' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
  FROM information_schema.tables
  WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type = 'BASE TABLE'
  ORDER BY 1;`;

function tableCounts(container: string): string {
  const run = psql(container, TABLE_COUNTS_SQL);
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout.trim();
}

/** SHA-256 di ogni oggetto dei due bucket, con il suo nome, in ordine. */
const OBJECT_HASHES = [
  'for b in media-public media-private; do',
  '  mc find "l/$b" | sort | while IFS= read -r p; do',
  '    printf "%s  %s\\n" "$(mc cat "$p" | sha256sum | cut -d" " -f1)" "$p"',
  '  done',
  'done',
].join('\n');

function objectHashes(endpoint: 'src' | 'dest'): string {
  const run = (endpoint === 'src' ? mcSrc : mcDest)(OBJECT_HASHES);
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout.trim();
}

const dbReady = (container: string) => (): boolean =>
  docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'amoris']).status === 0;
const objectsReady = (endpoint: string) => (): boolean =>
  mc(endpoint, 'mc ready l >/dev/null 2>&1').status === 0;
const sftpReady = (): boolean =>
  docker(
    runArgs({ RESTIC_PASSWORD_FILE: '/keys/restic_password' }, V.dataSrc, [
      'sh',
      '-c',
      'ssh -p 2222 -i /keys/client_ed25519 -o UserKnownHostsFile=/keys/known_hosts -o BatchMode=yes sftpuser@sftp -s sftp </dev/null >/dev/null 2>&1; test $? -ne 255',
    ]),
  ).status === 0;

async function waitFor(what: string, probe: () => boolean, seconds = 60): Promise<void> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (probe()) return;
    await sleep(1000);
  }
  throw new Error(`attesa scaduta: ${what}`);
}

function removeAll(): void {
  docker(['rm', '-f', '-v', ...Object.values(C)]);
  docker(['network', 'rm', NET]);
  docker(['volume', 'rm', '-f', ...Object.values(V)]);
}

/** Riporta la destinazione a «nuova e vuota»: database ricreato, bucket vuoti e presenti. */
function resetDestination(): void {
  const db = psql(
    C.dbDest,
    'DROP DATABASE IF EXISTS amoris WITH (FORCE);\nCREATE DATABASE amoris;',
    'postgres',
  );
  if (db.status !== 0) throw new Error(db.stderr);
  const buckets = mcDest(
    'for b in media-public media-private; do mc rb --force "l/$b" >/dev/null 2>&1 || true; mc mb "l/$b" >/dev/null || exit 1; done',
  );
  if (buckets.status !== 0) throw new Error(buckets.stderr);
}

/** Stato osservabile della destinazione: tabelle, conteggi, elenco degli oggetti e dei bucket. */
function destinationSnapshot(): string {
  const objects = mcDest('mc ls --recursive l/media-public l/media-private 2>&1; mc ls l 2>&1');
  return `${tableCounts(C.dbDest)}\n---\n${objects.stdout.replace(/\[[^\]]*\]\s+\S+\s+/g, '')}`;
}

beforeAll(async () => {
  const version = docker(['version', '--format', '{{.Server.Version}}']);
  if (version.status !== 0) throw new Error(`Docker non raggiungibile: ${version.stderr}`);
  removeAll();
  buildResult = await dockerBuild([
    'build',
    '-f',
    'infra/docker/backup.Dockerfile',
    '-t',
    IMAGE,
    '.',
  ]);
  sftpBuildResult = await dockerBuild([
    'build',
    '-f',
    'infra/deploy/tests/sftp-prova.Dockerfile',
    '-t',
    SFTP_IMAGE,
    '.',
  ]);
  if (buildResult.status !== 0 || sftpBuildResult.status !== 0) return;

  expect(docker(['network', 'create', '--internal', NET]).status).toBe(0);
  for (const volume of Object.values(V))
    expect(docker(['volume', 'create', volume]).status).toBe(0);

  const keygen = docker([
    'run',
    '--rm',
    '--user',
    'root',
    '-v',
    `${V.keys}:/keys`,
    '--entrypoint',
    'sh',
    SFTP_IMAGE,
    '-c',
    [
      'set -eu',
      'for n in host client; do ssh-keygen -q -t ed25519 -N "" -C "" -f /keys/${n}_ed25519; done',
      'printf "[sftp]:2222 %s\\n" "$(cut -d" " -f1,2 /keys/host_ed25519.pub)" > /keys/known_hosts',
      'cp /keys/client_ed25519.pub /keys/authorized_keys',
      'chmod 0444 /keys/client_ed25519 /keys/known_hosts /keys/authorized_keys',
      'chmod 0600 /keys/host_ed25519',
    ].join('\n'),
  ]);
  if (keygen.status !== 0) throw new Error(keygen.stderr);
  putSecret('restic_password', SECRETS.restic);
  putSecret('pg_password', SECRETS.pg);
  putSecret('pg_password_limited', SECRETS.pgLimited);
  putSecret('s3_access', SECRETS.s3Access);
  putSecret('s3_secret', SECRETS.s3Secret);

  const start = (name: string, args: string[]): void => {
    const run = docker(['run', '-d', '--name', name, '--network', NET, ...args]);
    if (run.status !== 0) throw new Error(run.stderr);
  };
  start(C.sftp, ['--network-alias', 'sftp', '-v', `${V.keys}:/keys:ro`, SFTP_IMAGE]);
  const pgEnv = [
    '-e',
    'POSTGRES_USER=amoris',
    '-e',
    `POSTGRES_PASSWORD=${SECRETS.pg}`,
    '-e',
    'POSTGRES_DB=amoris',
  ];
  start(C.db, ['--network-alias', 'db', ...pgEnv, DB_IMAGE]);
  start(C.dbDest, ['--network-alias', 'dbd', ...pgEnv, DB_IMAGE]);
  const minioEnv = [
    '-e',
    `MINIO_ROOT_USER=${SECRETS.s3Access}`,
    '-e',
    `MINIO_ROOT_PASSWORD=${SECRETS.s3Secret}`,
    '-e',
    'MINIO_BROWSER=off',
  ];
  start(C.objects, [
    '--network-alias',
    'objects',
    ...minioEnv,
    '-v',
    `${V.objects}:/data`,
    MINIO_IMAGE,
    'server',
    '/data',
  ]);
  start(C.objectsDest, [
    '--network-alias',
    'objd',
    ...minioEnv,
    '-v',
    `${V.objectsDest}:/data`,
    MINIO_IMAGE,
    'server',
    '/data',
  ]);

  await waitFor('database di origine', dbReady(C.db));
  await waitFor('database di destinazione', dbReady(C.dbDest));
  await waitFor('archivio di origine', objectsReady('http://objects:9000'));
  await waitFor('archivio di destinazione', objectsReady('http://objd:9000'));

  const seed = psql(
    C.db,
    [
      'CREATE SCHEMA drizzle;',
      'CREATE TABLE drizzle.migrazioni_sintetiche (id serial PRIMARY KEY, impronta text NOT NULL);',
      'CREATE TABLE pagine_sintetiche (id serial PRIMARY KEY, titolo text NOT NULL);',
      'CREATE TABLE righe_figlie (id serial PRIMARY KEY, pagina_id int NOT NULL REFERENCES pagine_sintetiche(id), testo text);',
      'CREATE TABLE utenti_sintetici (id serial PRIMARY KEY, nome text NOT NULL);',
      "INSERT INTO drizzle.migrazioni_sintetiche (impronta) VALUES ('a'), ('b');",
      `INSERT INTO pagine_sintetiche (titolo) VALUES ('${MARK_DB}'), ('titolo inventato due'), ('titolo inventato tre');`,
      "INSERT INTO righe_figlie (pagina_id, testo) VALUES (1, 'x'), (1, 'y'), (3, 'z');",
      "INSERT INTO utenti_sintetici (nome) VALUES ('nome inventato');",
    ].join('\n'),
  );
  if (seed.status !== 0) throw new Error(seed.stderr);

  const buckets = mcSrc(
    [
      'mc mb l/media-public >/dev/null',
      'mc mb l/media-private >/dev/null',
      'head -c 300000 /dev/urandom > /tmp/grande.bin',
      'printf "contenuto sintetico uno" > /tmp/uno.txt',
      'printf "contenuto sintetico due, diverso" > /tmp/due.txt',
      `mc cp /tmp/uno.txt "l/media-public/2026/${NAME_MARK} uno.txt" >/dev/null`,
      `mc cp /tmp/grande.bin "l/media-public/${NAME_MARK} grande.bin" >/dev/null`,
      `mc cp /tmp/due.txt "l/media-private/privati/${NAME_MARK} due.txt" >/dev/null`,
    ].join(' && '),
  );
  if (buckets.status !== 0) throw new Error(buckets.stderr);

  // Un ruolo senza permessi di creazione, per provare un ripristino che fallisce a metà.
  const limited = psql(
    C.dbDest,
    `CREATE ROLE limitato LOGIN PASSWORD '${SECRETS.pgLimited}';`,
    'postgres',
  );
  if (limited.status !== 0) throw new Error(limited.stderr);
});

afterEach(async () => {
  await sleep(100);
});

afterAll(() => {
  removeAll();
  docker(['image', 'rm', '-f', IMAGE, SFTP_IMAGE]);
});

interface Fingerprint {
  readonly tables: string;
  readonly objects: string;
}
const sourceFingerprint = (): Fingerprint => ({
  tables: tableCounts(C.db),
  objects: objectHashes('src'),
});
const destFingerprint = (): Fingerprint => ({
  tables: tableCounts(C.dbDest),
  objects: objectHashes('dest'),
});

let first: Fingerprint;
let second: Fingerprint;
let firstId = '';
let secondId = '';

describe('ripristino su database e bucket nuovi, con dati sintetici', () => {
  it('le immagini si costruiscono e il comando è nello script', () => {
    expect(buildResult?.status, buildResult?.stderr.slice(-4000)).toBe(0);
    expect(sftpBuildResult?.status, sftpBuildResult?.stderr.slice(-4000)).toBe(0);
    const entry = path.join(repoRoot, 'infra', 'deploy', 'backup', 'amoris-backup');
    expect(existsSync(entry)).toBe(true);
    const text = readFileSync(entry, 'utf8');
    expect(text).toMatch(/restore\)/);
    expect(text.includes('\r')).toBe(false);
  });

  it('prepara due istantanee con stati diversi dell’origine', () => {
    const init = docker(runArgs(SOURCE_ENV, V.dataSrc, ['amoris-backup', 'init']));
    outputs.push(`${init.stdout}\n${init.stderr}`);
    expect(init.status, init.stdout + init.stderr).toBe(0);

    first = sourceFingerprint();
    const one = backup();
    expect(one.run.status, one.run.stdout + one.run.stderr).toBe(0);
    firstId = one.line.snapshot_id ?? '';
    expect(firstId).toMatch(/^[0-9a-f]{64}$/);

    expect(
      psql(
        C.db,
        "INSERT INTO utenti_sintetici (nome) VALUES ('altro nome inventato');\nINSERT INTO righe_figlie (pagina_id, testo) VALUES (2, 'w');",
      ).status,
    ).toBe(0);
    expect(
      mcSrc(
        `printf "terzo contenuto" > /tmp/t.txt && mc cp /tmp/t.txt "l/media-public/${NAME_MARK} terzo.txt" >/dev/null && mc rm "l/media-private/privati/${NAME_MARK} due.txt" >/dev/null`,
      ).status,
    ).toBe(0);
    second = sourceFingerprint();
    expect(second).not.toEqual(first);
    const two = backup();
    expect(two.run.status, two.run.stdout + two.run.stderr).toBe(0);
    secondId = two.line.snapshot_id ?? '';
    expect(secondId).not.toBe(firstId);
  }, 240_000);

  it('per identificativo ripristina lo stato di quell’istantanea: stesse righe e stessi SHA-256', () => {
    resetDestination();
    const started = Date.now();
    const { run, line } = restore([firstId]);
    const elapsed = (Date.now() - started) / 1000;
    console.log(`tempo di un ripristino sintetico (docker run compreso): ${elapsed.toFixed(1)} s`);
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout.trim().split('\n')).toHaveLength(1);
    expect(line).toMatchObject({
      command: 'restore',
      outcome: 'ok',
      failed_step: null,
      exit_code: 0,
      snapshot_id: firstId,
      objects_count: 3,
    });
    expect(line.dump_bytes).toBeGreaterThan(0);
    expect(line.objects_bytes).toBe(
      300000 + 'contenuto sintetico uno'.length + 'contenuto sintetico due, diverso'.length,
    );
    expect(readStateFile('last-restore.json').trim()).toBe(run.stdout.trim());
    expect(destFingerprint()).toEqual(first);
    // La cartella di lavoro non resta nel volume dei dati.
    expect(listVolume(V.dataDest)).not.toContain('.restore');
  }, 180_000);

  it('con latest ripristina l’istantanea più recente su una destinazione di nuovo vuota', () => {
    resetDestination();
    const { run, line } = restore(['latest']);
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(line).toMatchObject({ outcome: 'ok', snapshot_id: secondId, objects_count: 3 });
    expect(destFingerprint()).toEqual(second);
    expect(listVolume(V.dataDest)).not.toContain('.restore');
  }, 180_000);

  it('una destinazione già ripristinata rifiuta un secondo ripristino', () => {
    const { run, line } = restore(['latest']);
    expect(run.status).not.toBe(0);
    expect(line).toMatchObject({ outcome: 'error', failed_step: 'target_db_not_empty' });
    expect(destFingerprint()).toEqual(second);
  }, 120_000);
});

describe('rifiuti e guasti: la destinazione non cambia', () => {
  const expectRefused = (
    args: string[],
    step: string,
    overrides: Record<string, string | null> = {},
  ): void => {
    const before = destinationSnapshot();
    const { run, line } = restore(args, overrides);
    expect(run.status).not.toBe(0);
    expect(line).toMatchObject({ command: 'restore', outcome: 'error', failed_step: step });
    expect(line.exit_code).toBe(run.status);
    expect(JSON.parse(readStateFile('last-restore.json'))).toMatchObject({ failed_step: step });
    expect(destinationSnapshot()).toBe(before);
    expect(listVolume(V.dataDest)).not.toContain('.restore');
  };

  it('senza argomento esce con codice diverso da 0 senza fare nulla', () => {
    resetDestination();
    const stateBefore = readStateFile('last-restore.json');
    const before = destinationSnapshot();
    const run = docker(runArgs(DEST_ENV, V.dataDest, ['amoris-backup', 'restore']));
    outputs.push(`${run.stdout}\n${run.stderr}`);
    expect(run.status).not.toBe(0);
    expect(run.stdout).not.toMatch(/"outcome"/);
    expect(readStateFile('last-restore.json')).toBe(stateBefore);
    expect(destinationSnapshot()).toBe(before);
  }, 120_000);

  it('un identificativo malformato è rifiutato prima di ogni cosa', () => {
    expectRefused(['../etc'], 'snapshot_arg');
  }, 120_000);

  it('un identificativo inesistente esce con codice diverso da 0', () => {
    expectRefused([UNKNOWN_SNAPSHOT], 'snapshot_lookup');
  }, 120_000);

  it('rifiuta un database con una tabella e non tocca nulla', () => {
    resetDestination();
    expect(psql(C.dbDest, 'CREATE TABLE gia_presente (i int);').status).toBe(0);
    expectRefused(['latest'], 'target_db_not_empty');
  }, 120_000);

  it('lo schema delle migrazioni di Drizzle conta come contenuto', () => {
    resetDestination();
    expect(psql(C.dbDest, 'CREATE SCHEMA drizzle;').status).toBe(0);
    expectRefused(['latest'], 'target_db_not_empty');
  }, 120_000);

  it('rifiuta un bucket che ha già un oggetto', () => {
    resetDestination();
    expect(
      mcDest('printf x > /tmp/x && mc cp /tmp/x l/media-private/esistente.txt >/dev/null').status,
    ).toBe(0);
    expectRefused(['latest'], 'target_bucket_not_empty');
  }, 120_000);

  it('rifiuta un bucket mancante senza crearlo', () => {
    resetDestination();
    expect(mcDest('mc rb --force l/media-public >/dev/null').status).toBe(0);
    expectRefused(['latest'], 'target_bucket_missing');
    expect(mcDest('mc ls l/media-public >/dev/null 2>&1').status).not.toBe(0);
  }, 120_000);

  it('con la destinazione SFTP spenta esce con codice diverso da 0', async () => {
    resetDestination();
    expect(docker(['stop', '-t', '2', C.sftp]).status).toBe(0);
    try {
      expectRefused(['latest'], 'repository');
    } finally {
      docker(['start', C.sftp]);
      await waitFor('SFTP di nuovo pronto', sftpReady);
    }
  }, 180_000);

  it('con un file di segreto inesistente esce con 78', () => {
    resetDestination();
    const { run, line } = restore(['latest'], { S3_SECRET_KEY_FILE: '/keys/non-esiste' });
    expect(run.status).toBe(78);
    expect(line).toMatchObject({ outcome: 'error', failed_step: 'config', exit_code: 78 });
  }, 120_000);

  it('se il ripristino del database fallisce a metà, nulla resta: transazione annullata e cartella di lavoro tolta', () => {
    resetDestination();
    const { run, line } = restore(['latest'], {
      PGUSER: 'limitato',
      PGPASSWORD_FILE: '/keys/pg_password_limited',
    });
    expect(run.status).not.toBe(0);
    expect(line).toMatchObject({ outcome: 'error', failed_step: 'db_restore' });
    expect(line.exit_code).toBe(run.status);
    expect(tableCounts(C.dbDest)).toBe('');
    expect(mcDest('mc ls --recursive l/media-public l/media-private').stdout.trim()).toBe('');
    expect(listVolume(V.dataDest)).not.toContain('.restore');
  }, 180_000);
});

describe('uscite', () => {
  it('nessuna uscita dei contenitori contiene dati, nomi di oggetti, password o chiavi (W3-6, W3-9)', () => {
    const clientKey = volumeShell(V.keys, 'cat /v/client_ed25519').stdout;
    const body = clientKey
      .split('\n')
      .filter((line) => line.length > 20 && !line.startsWith('-----'));
    expect(body.length).toBeGreaterThan(0);
    const forbidden = [
      ...Object.values(SECRETS),
      MARK_DB,
      NAME_MARK,
      'pagine_sintetiche',
      'utenti_sintetici',
      'righe_figlie',
      'migrazioni_sintetiche',
      'contenuto sintetico',
      'BEGIN OPENSSH',
      body[0] ?? '#',
    ];
    expect(outputs.length).toBeGreaterThan(10);
    for (const output of outputs) {
      for (const text of forbidden) expect(output).not.toContain(text);
    }
  });
});
