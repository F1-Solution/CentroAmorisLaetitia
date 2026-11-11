import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Compose di produzione e di staging (1F-W2 T6, criteri W2-2, W2-5, W2-6).
 *
 * Legge la configurazione risolta da `docker compose config`, con un ambiente sintetico e
 * senza leggere nessun `.env` della macchina, e controlla: variabili obbligatorie senza
 * predefinito, servizi e profili, immagini fissate, porte solo su Caddy, reti interne, limiti
 * di memoria entro gli 8 GB del server (DR-334) con produzione e staging insieme, limiti dei
 * media uguali per API e pulizia (DR-359), file system in sola lettura.
 *
 * Il comportamento di Caddy per ambiente (staging non indicizzabile) si prova avviando
 * l'immagine di Caddy del Compose con il suo `Caddyfile`. L'avvio dello stack intero è la T10.
 *
 * **Nessun dato reale**: tutti i valori sono sintetici e nessun contenitore vede un database.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const deployDir = path.join(repoRoot, 'infra', 'deploy');
const composeFile = path.join(deployDir, 'compose.yml');
const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

/** Ambiente sintetico completo; ogni prova ne toglie o cambia una parte. */
const BASE_ENV: Readonly<Record<string, string>> = {
  AMORIS_ENV: 'production',
  IMAGE_PREFIX: 'ghcr.io/esempio/amoris',
  IMAGE_TAG: '0123456789abcdef0123456789abcdef01234567',
  CADDY_SITE_ADDRESS: 'www.esempio.invalid',
  SITE_URL: 'https://www.esempio.invalid',
  POSTGRES_PASSWORD: 'password-sintetica-del-database-di-prova',
  DB_OWNER_PASSWORD: 'password-sintetica-del-proprietario-di-prova',
  DB_APP_PASSWORD: 'password-sintetica-del-ruolo-applicativo',
  DB_BACKUP_PASSWORD: 'password-sintetica-del-ruolo-di-backup',
  S3_ACCESS_KEY: 'chiave-sintetica-archivio',
  S3_SECRET_KEY: 'segreto-sintetico-archivio-abbastanza-lungo',
  S3_API_SECRET_KEY: 'segreto-sintetico-utente-api-abbastanza-lungo',
  S3_BACKUP_SECRET_KEY: 'segreto-sintetico-utente-backup-abbastanza-lungo',
  IP_HASH_SALT: 'sale-sintetico-per-il-compose-abbastanza-lungo',
  CSRF_SECRET: 'segreto-sintetico-per-il-compose-abbastanza-lungo',
  TOTP_ENCRYPTION_KEY: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
  SCRUB_SERVICE_TOKEN: 'gettone-sintetico-del-servizio-di-pulizia-1f',
  // DR-402: obbligatoria e diversa per ambiente, così due stack sullo stesso server non si sovrappongono.
  APP_SUBNET: '10.77.84.0/24',
  // DR-409: rete verso l'ingresso comune, l'unica da cui Caddy accetta l'indirizzo del visitatore.
  INGRESS_SUBNET: '10.77.88.0/24',
  // DR-412: rete d'uscita dei backup per ambiente, con la catena del firewall dell'host che la riguarda.
  BACKUP_OUT_SUBNET: '10.77.86.0/24',
  BACKUP_OUT_BRIDGE: 'amoris-bkp-prod',
  // N6: percorsi obbligatori e assoluti, fuori dalla cartella del rilascio.
  BACKUP_SSH_KEY_PATH: path.join(import.meta.dirname, 'chiave-ssh-sintetica'),
  BACKUP_KNOWN_HOSTS_PATH: path.join(import.meta.dirname, 'known-hosts-sintetico'),
};

const STAGING_ENV: Readonly<Record<string, string>> = {
  ...BASE_ENV,
  AMORIS_ENV: 'staging',
  CADDY_SITE_ADDRESS: 'prova.esempio.invalid',
  SITE_URL: 'https://prova.esempio.invalid',
  APP_SUBNET: '10.77.85.0/24',
  INGRESS_SUBNET: '10.77.89.0/24',
  BACKUP_OUT_SUBNET: '10.77.87.0/24',
  BACKUP_OUT_BRIDGE: 'amoris-bkp-stag',
};

const REQUIRED = Object.keys(BASE_ENV);

/** Variabili del backup (solo produzione): facoltative, senza di esse il servizio si rifiuta di partire. */
const BACKUP_ENV: Readonly<Record<string, string>> = {
  ...BASE_ENV,
  RESTIC_PASSWORD: 'password-sintetica-del-repository-di-prova',
  BACKUP_SFTP_HOST: 'storage.esempio.invalid',
  BACKUP_SFTP_USER: 'utente-di-prova',
  BACKUP_SFTP_PATH: 'amoris-prova',
};

/** Valori dello staging sopra `BACKUP_ENV`, che parte dalla produzione. */
const STAGING_BACKUP: Readonly<Record<string, string>> = {
  BACKUP_OUT_SUBNET: STAGING_ENV.BACKUP_OUT_SUBNET ?? '',
  BACKUP_OUT_BRIDGE: STAGING_ENV.BACKUP_OUT_BRIDGE ?? '',
};

/**
 * L'ambiente della macchina senza le chiavi che il Compose interpola: per Compose l'ambiente
 * del processo prevale sul file, e un valore della macchina falserebbe la prova.
 */
function cleanProcessEnv(): Record<string, string> {
  const drop =
    /^(AMORIS_|IMAGE_|CADDY_|SITE_URL|POSTGRES_|DB_|S3_|BACKUP_|IP_HASH_SALT|CSRF_SECRET|SCRUB_|MEDIA_|LOG_LEVEL|COMPOSE_|APP_SUBNET|INGRESS_)/i;
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => !drop.test(entry[0]) && entry[1] !== undefined,
    ),
  );
}

const workDir = mkdtempSync(path.join(tmpdir(), 'amoris-compose-'));
let envFiles = 0;

function compose(env: Readonly<Record<string, string>>, args: string[]) {
  const envFile = path.join(workDir, `ambiente-${envFiles++}.env`);
  writeFileSync(
    envFile,
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
  return spawnSync('docker', ['compose', '-f', composeFile, '--env-file', envFile, ...args], {
    cwd: deployDir,
    env: cleanProcessEnv(),
    encoding: 'utf8',
    timeout: 60_000,
  });
}

interface Service {
  image: string;
  profiles?: string[];
  ports?: unknown[];
  networks?: Record<string, { aliases?: string[] } | null>;
  mem_limit?: string | number;
  environment?: Record<string, string>;
  read_only?: boolean;
  tmpfs?: string[];
  cap_drop?: string[];
  security_opt?: string[];
  healthcheck?: { test?: string[] };
  restart?: string;
  logging?: { driver?: string; options?: Record<string, string> };
  init?: boolean;
  command?: string[] | null;
  entrypoint?: string[];
  secrets?: { source: string; target: string }[];
  volumes?: { source?: string; target: string }[];
  depends_on?: Record<string, { condition: string }>;
}

interface Config {
  name: string;
  services: Record<string, Service>;
  networks: Record<
    string,
    {
      internal?: boolean;
      external?: boolean;
      name?: string;
      ipam?: { config?: { subnet?: string }[] };
      driver_opts?: Record<string, string>;
    }
  >;
  volumes: Record<string, { name?: string }>;
  secrets?: Record<string, { file?: string; environment?: string }>;
}

function config(env: Readonly<Record<string, string>>, profiles: string[] = []): Config {
  const result = compose(env, [
    ...profiles.flatMap((profile) => ['--profile', profile]),
    'config',
    '--format',
    'json',
  ]);
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as Config;
}

/** `mem_limit` in byte: Compose lo normalizza in numero, ma accetta anche «512m». */
function bytes(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  const match = /^(\d+)([kmg]?)b?$/i.exec(value ?? '');
  if (!match) return Number.NaN;
  const unit = { '': 1, k: 1024, m: MIB, g: GIB }[match[2]?.toLowerCase() ?? ''] ?? Number.NaN;
  return Number(match[1]) * unit;
}

/** Servizi che restano accesi: `objects-init` e `migrate` escono a lavoro finito. */
const LONG_RUNNING = ['caddy', 'web', 'admin', 'api', 'scrub', 'db', 'objects'];
const OUR_IMAGES = ['web', 'admin', 'api', 'scrub'] as const;

let production: Config;
let staging: Config;
let release: Config;
let backup: Config;

beforeAll(() => {
  const version = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
  if (version.status !== 0) throw new Error(`Docker Compose non disponibile: ${version.stderr}`);
  production = config(BASE_ENV);
  staging = config(STAGING_ENV);
  release = config(BASE_ENV, ['release']);
  backup = config(BACKUP_ENV, ['backup']);
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('variabili obbligatorie (W2-6)', () => {
  it.each(REQUIRED)('senza %s il Compose non parte e la nomina', (key) => {
    const env = Object.fromEntries(Object.entries(BASE_ENV).filter(([name]) => name !== key));
    const result = compose(env, ['config', '--quiet']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(key);
  });

  it('nessun segreto ha un valore predefinito nel file', () => {
    const text = readFileSync(composeFile, 'utf8');
    for (const key of REQUIRED) {
      expect(text, key).not.toMatch(new RegExp(`\\$\\{${key}:?-`));
    }
  });
});

describe('servizi e immagini (W2-1, ADR-009 §4.4)', () => {
  it('avvia caddy, sito, area, API, pulizia, database e archivio; le migrazioni solo a parte', () => {
    expect(Object.keys(production.services).sort()).toEqual(
      ['admin', 'api', 'caddy', 'db', 'db-init', 'objects', 'objects-init', 'scrub', 'web'].sort(),
    );
    expect(Object.keys(release.services)).toContain('migrate');
    const migrate = release.services.migrate;
    expect(migrate?.profiles).toEqual(['release']);
    expect(migrate?.command).toEqual(['node', 'bin/migrate.js']);
    expect(migrate?.restart).toBe('no');
  });

  it('le immagini del progetto vengono dal registro con l’etichetta del commit', () => {
    for (const app of OUR_IMAGES) {
      expect(production.services[app]?.image).toBe(
        `${BASE_ENV.IMAGE_PREFIX}-${app}:${BASE_ENV.IMAGE_TAG}`,
      );
    }
    expect(release.services.migrate?.image).toBe(production.services.api?.image);
  });

  it('le immagini di terzi sono fissate per digest, senza «latest»', () => {
    for (const [name, service] of Object.entries(production.services)) {
      expect(service.image, name).not.toMatch(/:latest\b/);
      if ((OUR_IMAGES as readonly string[]).includes(name)) continue;
      expect(service.image, name).toMatch(/@sha256:[0-9a-f]{64}$/);
    }
    expect(production.services.caddy?.image).toMatch(/^caddy:\d+\.\d+\.\d+-alpine@sha256:/);
    expect(production.services.db?.image).toMatch(/^postgres:\d+\.\d+-alpine@sha256:/);
  });

  it('Caddy è della linea 2.11, fissato per digest (DR-416)', () => {
    expect(production.services.caddy?.image).toMatch(
      /^caddy:2\.11\.\d+-alpine@sha256:[0-9a-f]{64}$/,
    );
  });

  it('il comando caddy hash-password dell’esempio di produzione usa la stessa immagine di Caddy', () => {
    const example = readFileSync(path.join(deployDir, '.env.production.example'), 'utf8');
    const match = /docker run --rm -it (\S+) caddy hash-password/.exec(example);
    expect(match?.[1]).toBe(production.services.caddy?.image);
  });

  it('ogni servizio acceso ha un controllo di salute, nel Compose o nel Dockerfile', () => {
    for (const name of LONG_RUNNING) {
      const service = production.services[name];
      const inDockerfile = (OUR_IMAGES as readonly string[]).includes(name)
        ? /^HEALTHCHECK\s/m.test(
            readFileSync(path.join(repoRoot, 'infra', 'docker', `${name}.Dockerfile`), 'utf8'),
          )
        : false;
      expect(inDockerfile || (service?.healthcheck?.test?.length ?? 0) > 0, name).toBe(true);
      expect(service?.restart, name).toBe('unless-stopped');
    }
  });
});

describe('porte e reti (W2-5, DR-359)', () => {
  it('nessun servizio dell’ambiente pubblica porte: le pubblica l’ingresso comune (DR-409)', () => {
    for (const stack of [production, staging, backup]) {
      const published = Object.entries(stack.services)
        .filter(([, service]) => (service.ports?.length ?? 0) > 0)
        .map(([name]) => name);
      expect(published).toEqual([]);
    }
  });

  it('l’unica rete con uscita è quella del backup; Caddy sta su app e sulla rete dell’ingresso', () => {
    const outbound = Object.entries(backup.networks)
      .filter(([, network]) => network.internal !== true && network.external !== true)
      .map(([name]) => name);
    expect(outbound).toEqual(['backup-out']);
    expect(Object.keys(production.services.caddy?.networks ?? {}).sort()).toEqual([
      'app',
      'ingresso',
    ]);
    for (const [name, service] of Object.entries(production.services)) {
      if (name === 'caddy') continue;
      expect(Object.keys(service.networks ?? {}), name).not.toContain('ingresso');
    }
  });

  it('la rete dell’ingresso è quella del proprio ambiente, già creata dall’ingresso, con un nome per Caddy', () => {
    for (const [stack, name] of [
      [production, 'production'],
      [staging, 'staging'],
    ] as const) {
      expect(stack.networks.ingresso?.external).toBe(true);
      expect(stack.networks.ingresso?.name).toBe(`amoris-ingresso-${name}`);
      expect(stack.services.caddy?.networks?.ingresso?.aliases).toEqual([`amoris-${name}-caddy`]);
      expect(stack.services.caddy?.environment?.INGRESS_SUBNET).toBe(
        name === 'production' ? '10.77.88.0/24' : '10.77.89.0/24',
      );
    }
  });

  it('rete app e TRUSTED_PROXY dell API seguono l APP_SUBNET di ciascun ambiente (N3, DR-402)', () => {
    const subnetOf = (resolved: Config) => resolved.networks.app?.ipam?.config?.[0]?.subnet;
    expect(subnetOf(production)).toBe('10.77.84.0/24');
    expect(subnetOf(staging)).toBe('10.77.85.0/24');
    expect(production.services.api?.environment?.TRUSTED_PROXY).toBe('10.77.84.0/24');
    expect(staging.services.api?.environment?.TRUSTED_PROXY).toBe('10.77.85.0/24');
  });

  it('l API conosce il proprio ambiente, per la conferma del primo account (R24)', () => {
    expect(production.services.api?.environment?.AMORIS_ENV).toBe('production');
    expect(staging.services.api?.environment?.AMORIS_ENV).toBe('staging');
  });

  it('backup-out ha sottorete e bridge dell ambiente, diversi dalle altre reti (R13, DR-412)', () => {
    const out = backup.networks['backup-out'];
    expect(out?.ipam?.config?.[0]?.subnet).toBe('10.77.86.0/24');
    expect(out?.driver_opts?.['com.docker.network.bridge.name']).toBe('amoris-bkp-prod');
    const other = config({ ...BACKUP_ENV, ...STAGING_ENV, ...STAGING_BACKUP }, ['backup']);
    const stagingOut = other.networks['backup-out'];
    expect(stagingOut?.ipam?.config?.[0]?.subnet).toBe('10.77.87.0/24');
    expect(stagingOut?.driver_opts?.['com.docker.network.bridge.name']).toBe('amoris-bkp-stag');
    const subnets = [
      backup.networks.app?.ipam?.config?.[0]?.subnet,
      out?.ipam?.config?.[0]?.subnet,
      stagingOut?.ipam?.config?.[0]?.subnet,
      other.networks.app?.ipam?.config?.[0]?.subnet,
    ];
    expect(new Set(subnets).size).toBe(subnets.length);
  });

  it.each(['BACKUP_OUT_SUBNET', 'BACKUP_OUT_BRIDGE'])(
    '%s è obbligatoria e il messaggio indica i valori dei due ambienti (DR-412)',
    (key) => {
      const env = Object.fromEntries(Object.entries(BASE_ENV).filter(([name]) => name !== key));
      const result = compose(env, ['config', '--quiet']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(key);
      expect(result.stderr).toMatch(/10\.77\.86\.0\/24|amoris-bkp-prod/);
      expect(result.stderr).toMatch(/10\.77\.87\.0\/24|amoris-bkp-stag/);
    },
  );

  it('backup e restore dello staging stanno sulla rete d uscita dello staging (DR-412)', () => {
    const other = config({ ...BACKUP_ENV, ...STAGING_ENV, ...STAGING_BACKUP }, ['backup']);
    for (const name of ['backup', 'restore']) {
      expect(Object.keys(other.services[name]?.networks ?? {}), name).toContain('backup-out');
    }
    expect(other.networks['backup-out']?.name).toBe('amoris-staging_backup-out');
  });

  it('database e archivio non stanno sulla rete di Caddy', () => {
    const caddyNetworks = new Set(Object.keys(production.services.caddy?.networks ?? {}));
    for (const name of ['db', 'db-init', 'objects', 'objects-init', 'scrub']) {
      const shared = Object.keys(production.services[name]?.networks ?? {}).filter((network) =>
        caddyNetworks.has(network),
      );
      expect(shared, name).toEqual([]);
    }
  });

  it('la pulizia è raggiungibile solo dall’API', () => {
    const scrubNetworks = Object.keys(production.services.scrub?.networks ?? {});
    expect(scrubNetworks).toHaveLength(1);
    const members = Object.entries(production.services)
      .filter(([, service]) => Object.keys(service.networks ?? {}).includes(scrubNetworks[0] ?? ''))
      .map(([name]) => name)
      .sort();
    expect(members).toEqual(['api', 'scrub']);
    expect(production.services.api?.environment?.SCRUB_SERVICE_URL).toBe('http://scrub:3003');
  });
});

describe('limiti (W2-5, DR-263, DR-334)', () => {
  it('ogni servizio ha un limite di memoria; la pulizia ha 1 GB', () => {
    for (const [name, service] of Object.entries(release.services)) {
      expect(bytes(service.mem_limit), name).toBeGreaterThan(0);
    }
    expect(bytes(production.services.scrub?.mem_limit)).toBe(GIB);
  });

  it('produzione e staging insieme restano sotto 7 GB, lasciando 1 GB al sistema', () => {
    const sum = (stack: Config, names: string[]) =>
      names.reduce((total, name) => total + bytes(stack.services[name]?.mem_limit), 0);
    // Il backup gira solo in produzione (DR-372): 3712 MiB contro i 3328 MiB dello staging.
    const total = sum(backup, [...LONG_RUNNING, 'backup']) + sum(staging, LONG_RUNNING);
    expect(total).toBe(7040 * MIB);
    expect(total).toBeLessThanOrEqual(7 * GIB);
  });

  it('API e pulizia ricevono gli stessi limiti dei media, anche quando cambiano', () => {
    const changed = config({
      ...BASE_ENV,
      MEDIA_MAX_PDF_BYTES: String(30 * MIB),
      MEDIA_MAX_VIDEO_BYTES: String(80 * MIB),
    });
    for (const stack of [production, changed]) {
      const api = stack.services.api?.environment ?? {};
      const scrub = stack.services.scrub?.environment ?? {};
      expect(scrub.MEDIA_MAX_PDF_BYTES).toBe(api.MEDIA_MAX_PDF_BYTES);
      expect(scrub.MEDIA_MAX_VIDEO_BYTES).toBe(api.MEDIA_MAX_VIDEO_BYTES);
    }
    expect(changed.services.scrub?.environment?.MEDIA_MAX_VIDEO_BYTES).toBe(String(80 * MIB));
  });

  it('la cartella temporanea della pulizia contiene originale e ripulito del video più grande', () => {
    const tmp = production.services.scrub?.tmpfs?.find((entry) => entry.startsWith('/tmp'));
    const size = /size=(\d+[kmg]?)/i.exec(tmp ?? '')?.[1];
    const video = Number(production.services.scrub?.environment?.MEDIA_MAX_VIDEO_BYTES);
    expect(bytes(size)).toBeGreaterThanOrEqual(2 * video);
  });

  it('le applicazioni girano in sola lettura, senza capacità e senza nuovi privilegi', () => {
    for (const name of OUR_IMAGES) {
      const service = production.services[name];
      expect(service?.read_only, name).toBe(true);
      expect(
        service?.tmpfs?.some((entry) => entry.startsWith('/tmp')),
        name,
      ).toBe(true);
      expect(service?.cap_drop, name).toEqual(['ALL']);
      expect(service?.security_opt, name).toContain('no-new-privileges:true');
    }
  });
});

describe('rotazione dei log (1F-W4 T6f, DR-390)', () => {
  it('ogni servizio, anche quello a termine e il backup, usa json-file da 10 MB per 5 file', () => {
    for (const stack of [production, staging, release, backup]) {
      for (const [name, service] of Object.entries(stack.services)) {
        expect(service.logging, name).toEqual({
          driver: 'json-file',
          options: { 'max-size': '10m', 'max-file': '5' },
        });
      }
    }
    expect(Object.keys(backup.services)).toContain('backup');
  });
});

describe('servizio di backup (1F-W3 T4, DR-367, DR-372)', () => {
  const service = () => backup.services.backup;
  const outNetwork = 'backup-out';

  it('esiste solo nel profilo backup: senza profilo non c’è', () => {
    expect(production.services.backup).toBeUndefined();
    expect(service()?.profiles).toEqual(['backup']);
    expect(service()?.image).toBe(`${BASE_ENV.IMAGE_PREFIX}-backup:${BASE_ENV.IMAGE_TAG}`);
  });

  it('è a termine: nessuna porta, nessun riavvio, comando scelto da chi lo lancia', () => {
    expect(service()?.ports ?? []).toEqual([]);
    expect(service()?.restart).toBe('no');
    expect(service()?.entrypoint).toEqual(['amoris-backup']);
    expect(service()?.command ?? null).toBeNull();
  });

  it('ha un processo init: lo script non è PID 1 e i segnali gli arrivano', () => {
    expect(service()?.init).toBe(true);
  });

  it('gira in sola lettura, senza capacità e senza nuovi privilegi, con memoria limitata', () => {
    expect(service()?.read_only).toBe(true);
    expect(service()?.cap_drop).toEqual(['ALL']);
    expect(service()?.security_opt).toContain('no-new-privileges:true');
    expect(bytes(service()?.mem_limit)).toBe(384 * MIB);
    expect(service()?.environment?.GOMEMLIMIT).toBe('256MiB');
    expect(service()?.tmpfs?.some((entry) => entry.startsWith('/tmp'))).toBe(true);
  });

  it('tre volumi con nome per dati, stato e cache; nessun volume anonimo dell’immagine di base', () => {
    const named = (service()?.volumes ?? []).map((volume) => [volume.source, volume.target]);
    expect(named).toEqual([
      ['backup-data', '/backup/data'],
      ['backup-state', '/backup/state'],
      ['backup-cache', '/backup/cache'],
    ]);
    expect(service()?.tmpfs?.some((entry) => entry.startsWith('/var/lib/postgresql/data'))).toBe(
      true,
    );
  });

  it('sta sulla rete dei dati e su una rete d’uscita che nessun altro servizio usa', () => {
    expect(Object.keys(service()?.networks ?? {}).sort()).toEqual([outNetwork, 'data']);
    expect(backup.networks[outNetwork]?.internal).not.toBe(true);
    expect(backup.networks.data?.internal).toBe(true);
    expect(backup.networks.app?.internal).toBe(true);
    expect(backup.networks.scrub?.internal).toBe(true);
    const members = Object.entries(backup.services)
      .filter(([, other]) => Object.keys(other.networks ?? {}).includes(outNetwork))
      .map(([name]) => name);
    expect(members).toEqual(['backup', 'restore']);
  });

  it('solo le tre variabili dell’API e la password di restic portano un segreto nell’ambiente', () => {
    const env = service()?.environment ?? {};
    expect(env).toMatchObject({
      PGPASSWORD: BASE_ENV.DB_BACKUP_PASSWORD,
      S3_ACCESS_KEY: 'amoris-backup',
      S3_SECRET_KEY: BASE_ENV.S3_BACKUP_SECRET_KEY,
      RESTIC_PASSWORD: BACKUP_ENV.RESTIC_PASSWORD,
    });
    const allowed = ['PGPASSWORD', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'RESTIC_PASSWORD'];
    const secretValues = [
      BASE_ENV.IP_HASH_SALT,
      BASE_ENV.CSRF_SECRET,
      BASE_ENV.SCRUB_SERVICE_TOKEN,
      BACKUP_ENV.BACKUP_SSH_KEY_PATH,
      BACKUP_ENV.BACKUP_KNOWN_HOSTS_PATH,
    ];
    for (const [key, value] of Object.entries(env)) {
      if (allowed.includes(key)) continue;
      expect(secretValues, key).not.toContain(value);
      expect(value, key).not.toMatch(/sintetic[oa]/);
    }
    expect(env.PGPASSWORD_FILE).toBeUndefined();
  });

  it('chiave SSH e known_hosts arrivano come file in /run/secrets, con percorso predefinito', () => {
    expect(
      service()
        ?.secrets?.map((secret) => secret.target)
        .sort(),
    ).toEqual(['/run/secrets/backup_known_hosts', '/run/secrets/backup_ssh_key']);
    const files = Object.fromEntries(
      Object.entries(backup.secrets ?? {}).map(([name, secret]) => [name, secret.file]),
    );
    expect(files).toEqual({
      backup_ssh_key: BACKUP_ENV.BACKUP_SSH_KEY_PATH,
      backup_known_hosts: BACKUP_ENV.BACKUP_KNOWN_HOSTS_PATH,
    });
  });

  it.each(['BACKUP_SSH_KEY_PATH', 'BACKUP_KNOWN_HOSTS_PATH'])(
    'N6: senza %s il Compose non parte e non c’è un percorso predefinito',
    (key) => {
      const env = Object.fromEntries(Object.entries(BASE_ENV).filter(([name]) => name !== key));
      const result = compose(env, ['config', '--quiet']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(key);
      expect(readFileSync(composeFile, 'utf8')).not.toContain('./backup-chiavi');
    },
  );

  it('destinazione e database arrivano dalle variabili; la porta SFTP vale 23 se non indicata', () => {
    expect(service()?.environment).toMatchObject({
      PGHOST: 'db',
      PGUSER: 'amoris_backup',
      PGDATABASE: 'amoris',
      S3_ENDPOINT: 'http://objects:9000',
      S3_BUCKET_PUBLIC: 'media-public',
      S3_BUCKET_PRIVATE: 'media-private',
      BACKUP_SFTP_HOST: BACKUP_ENV.BACKUP_SFTP_HOST,
      BACKUP_SFTP_PORT: '23',
      BACKUP_SFTP_USER: BACKUP_ENV.BACKUP_SFTP_USER,
      BACKUP_SFTP_PATH: BACKUP_ENV.BACKUP_SFTP_PATH,
    });
  });

  it('senza le variabili del backup il Compose parte e le lascia vuote (lo script risponde 78)', () => {
    const bare = config(BASE_ENV, ['backup']).services.backup?.environment ?? {};
    for (const key of [
      'RESTIC_PASSWORD',
      'BACKUP_SFTP_HOST',
      'BACKUP_SFTP_USER',
      'BACKUP_SFTP_PATH',
    ]) {
      expect(bare[key], key).toBe('');
    }
    for (const key of [
      'RESTIC_PASSWORD',
      'BACKUP_SFTP_HOST',
      'BACKUP_SFTP_USER',
      'BACKUP_SFTP_PATH',
    ]) {
      expect(readFileSync(composeFile, 'utf8'), key).toContain(`\${${key}:-}`);
    }
  });

  it('senza profilo, con l’esempio completo, gli altri servizi restano gli stessi', () => {
    expect(Object.keys(production.services).sort()).toEqual(
      ['admin', 'api', 'caddy', 'db', 'db-init', 'objects', 'objects-init', 'scrub', 'web'].sort(),
    );
    for (const [name, other] of Object.entries(production.services)) {
      expect(Object.keys(other.networks ?? {}), name).not.toContain(outNetwork);
    }
  });

  it('la cartella predefinita delle chiavi del backup è esclusa da Git', () => {
    // La chiave SSH privata non deve poter finire in un commit per errore.
    for (const file of ['ssh_key', 'known_hosts']) {
      const target = path.join(repoRoot, 'infra', 'deploy', 'backup-chiavi', file);
      const ignored = spawnSync('git', ['check-ignore', '-q', target], { cwd: repoRoot });
      expect(ignored.status, file).toBe(0);
    }
  });
});

/**
 * Prova di fumo con l'immagine di backup costruita in locale (`amoris-backup:prova-1f`): saltata
 * se manca. Senza argomenti il servizio esce con 64, senza le variabili del backup con 78, e i
 * segreti sono leggibili dall'utente 10003.
 */
describe('servizio di backup avviato', () => {
  const image = 'amoris-backup:prova-1f';
  const present =
    spawnSync('docker', ['image', 'inspect', image], { encoding: 'utf8' }).status === 0;
  const project = `amoris-prova-t4-${process.pid}`;
  const smoke = { IMAGE_PREFIX: 'amoris', IMAGE_TAG: 'prova-1f' };
  const smokeEnv = { ...BACKUP_ENV, ...smoke };

  /** File sintetici di chiave e known_hosts nella cartella di lavoro. */
  function keyFiles(): Record<string, string> {
    const keys = path.join(workDir, 'chiavi');
    mkdirSync(keys, { recursive: true });
    const paths = {
      BACKUP_SSH_KEY_PATH: path.join(keys, 'ssh_key'),
      BACKUP_KNOWN_HOSTS_PATH: path.join(keys, 'known_hosts'),
    };
    for (const file of Object.values(paths)) writeFileSync(file, 'contenuto-sintetico\n');
    return paths;
  }

  function run(args: string[], env: Readonly<Record<string, string>> = smokeEnv) {
    return compose({ ...env, ...keyFiles() }, [
      '-p',
      project,
      '--profile',
      'backup',
      'run',
      '--rm',
      '--no-deps',
      '-T',
      ...args,
    ]);
  }

  afterAll(() => {
    if (!present) return;
    compose(smokeEnv, ['-p', project, '--profile', 'backup', 'down', '-v', '--remove-orphans']);
  });

  it.skipIf(!present)('senza argomenti esce con 64', () => {
    const result = run(['backup']);
    expect(result.status, result.stderr).toBe(64);
  });

  it.skipIf(!present)('senza le variabili del backup esce con 78', () => {
    const result = run(['backup', 'backup'], { ...BASE_ENV, ...smoke });
    expect(result.status, result.stderr).toBe(78);
    expect(result.stdout).not.toContain(BASE_ENV.POSTGRES_PASSWORD);
  });

  it.skipIf(!present)('i file in /run/secrets sono leggibili dall’utente 10003', () => {
    const result = run([
      '--entrypoint',
      'sh',
      'backup',
      '-c',
      'id -u; for f in /run/secrets/*; do head -c 1 "$f" >/dev/null || exit 1; done; ls /run/secrets | wc -l',
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split(/\s+/)).toEqual(['10003', '2']);
  });
});

describe('produzione e staging separati (W2-6, DR-296)', () => {
  it('progetti, volumi e porte diversi', () => {
    expect(production.name).toBe('amoris-production');
    expect(staging.name).toBe('amoris-staging');
    const volumeNames = (stack: Config) =>
      Object.values(stack.volumes).map((volume) => volume.name);
    const shared = volumeNames(production).filter((name) => volumeNames(staging).includes(name));
    expect(shared).toEqual([]);
    expect(production.networks.ingresso?.name).not.toBe(staging.networks.ingresso?.name);
  });

  it('un ambiente diverso da production e staging non è ammesso', () => {
    const result = compose({ ...BASE_ENV, AMORIS_ENV: 'prova' }, ['config', '--quiet']);
    expect(result.status).not.toBe(0);
  });
});

/**
 * Immagine di Caddy del Compose con il suo `Caddyfile` (W2-6, PLAN W5). Al posto di sito, area
 * e API risponde un finto servizio (Caddy stesso) che manda `X-Robots-Tag: all`, come farebbe
 * una pagina del sito: in staging Caddy deve comunque sostituirlo.
 */
describe('Caddy per ambiente', () => {
  const started: string[] = [];
  const network = `amoris-caddy-prova-${process.pid}`;
  const caddyImage = () => production.services.caddy?.image ?? '';

  function run(args: string[]): string {
    const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 300_000 });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  }

  let stagingBase = '';
  // Hash di una password sintetica, generato al volo: nessun hash nel repository.
  let stagingHash = '';

  beforeAll(() => {
    stagingHash = run([
      'run',
      '--rm',
      caddyImage(),
      'caddy',
      'hash-password',
      '--plaintext',
      'password-sintetica',
    ]);
    spawnSync('docker', ['network', 'rm', network]);
    run(['network', 'create', network]);
    started.push(
      run([
        'run',
        '-d',
        '--network',
        network,
        '--network-alias',
        'web',
        '--network-alias',
        'admin',
        '--network-alias',
        'api',
        caddyImage(),
        'caddy',
        'respond',
        '--listen',
        ':3000-3002',
        '--header',
        'X-Robots-Tag: all',
        'dal-servizio',
      ]),
    );
  });

  afterAll(() => {
    if (started.length > 0) spawnSync('docker', ['rm', '-f', ...started]);
    spawnSync('docker', ['network', 'rm', network]);
  });

  function startCaddy(env: string): string {
    const id = run([
      'run',
      '-d',
      '--network',
      network,
      '-p',
      '127.0.0.1::80',
      '-e',
      `AMORIS_ENV=${env}`,
      '-e',
      'CADDY_SITE_ADDRESS=:80',
      '-e',
      'INGRESS_SUBNET=10.77.88.0/24',
      ...(env === 'staging'
        ? ['-e', 'STAGING_BASIC_AUTH_USER=prova', '-e', `STAGING_BASIC_AUTH_HASH=${stagingHash}`]
        : []),
      '-v',
      `${path.join(deployDir, 'caddy')}:/etc/caddy:ro`,
      caddyImage(),
    ]);
    started.push(id);
    const match = /:(\d+)\s*$/m.exec(run(['port', id, '80/tcp']));
    if (!match?.[1]) throw new Error('porta di Caddy non trovata');
    return `http://127.0.0.1:${match[1]}`;
  }

  const STAGING_AUTH = {
    Authorization: `Basic ${Buffer.from('prova:password-sintetica').toString('base64')}`,
  };

  async function get(base: string, pathname: string): Promise<Response> {
    const deadline = Date.now() + 20_000;
    for (;;) {
      try {
        const response = await fetch(`${base}${pathname}`, {
          redirect: 'manual',
          headers: base === stagingBase ? STAGING_AUTH : {},
        });
        // All'avvio il finto servizio può non essere ancora pronto.
        if (response.status !== 502 || Date.now() > deadline) return response;
      } catch (error) {
        if (Date.now() > deadline) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  it('in staging nessuna pagina è indicizzabile e robots.txt rifiuta tutto', async () => {
    const base = startCaddy('staging');
    stagingBase = base;
    expect((await fetch(`${base}/robots.txt`)).status).toBe(401);
    const robots = await get(base, '/robots.txt');
    expect(robots.status).toBe(200);
    expect(await robots.text()).toMatch(/^User-agent: \*\s+Disallow: \/\s*$/);
    for (const pathname of ['/', '/una-pagina/', '/admin/', '/api/auth/me', '/media/x.jpg']) {
      const response = await get(base, pathname);
      expect(response.status, pathname).toBe(200);
      expect(response.headers.get('x-robots-tag'), pathname).toBe('noindex, nofollow');
    }
  });

  it('in produzione robots.txt e intestazioni del sito passano, l’area resta non indicizzabile', async () => {
    const base = startCaddy('production');
    const robots = await get(base, '/robots.txt');
    expect(await robots.text()).toBe('dal-servizio');
    const home = await get(base, '/');
    expect(home.headers.get('x-robots-tag')).toBe('all');
    expect(home.headers.get('x-content-type-options')).toBe('nosniff');
    expect(home.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect((await get(base, '/admin/')).headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('il controllo di salute di Caddy risponde dentro il contenitore', () => {
    const id = started.at(-1) ?? '';
    const test = production.services.caddy?.healthcheck?.test ?? [];
    expect(test[0]).toBe('CMD');
    const result = spawnSync('docker', ['exec', id, ...test.slice(1)], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });
});
