import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  CADDY_HTTP_PORT: '80',
  CADDY_HTTPS_PORT: '443',
  SITE_URL: 'https://www.esempio.invalid',
  POSTGRES_PASSWORD: 'password-sintetica-del-database-di-prova',
  S3_ACCESS_KEY: 'chiave-sintetica-archivio',
  S3_SECRET_KEY: 'segreto-sintetico-archivio-abbastanza-lungo',
  IP_HASH_SALT: 'sale-sintetico-per-il-compose-abbastanza-lungo',
  CSRF_SECRET: 'segreto-sintetico-per-il-compose-abbastanza-lungo',
  SCRUB_SERVICE_TOKEN: 'gettone-sintetico-del-servizio-di-pulizia-1f',
};

const STAGING_ENV: Readonly<Record<string, string>> = {
  ...BASE_ENV,
  AMORIS_ENV: 'staging',
  CADDY_SITE_ADDRESS: 'prova.esempio.invalid',
  CADDY_HTTP_PORT: '8080',
  CADDY_HTTPS_PORT: '8443',
  SITE_URL: 'https://prova.esempio.invalid',
};

const REQUIRED = Object.keys(BASE_ENV);

/**
 * L'ambiente della macchina senza le chiavi che il Compose interpola: per Compose l'ambiente
 * del processo prevale sul file, e un valore della macchina falserebbe la prova.
 */
function cleanProcessEnv(): Record<string, string> {
  const drop =
    /^(AMORIS_|IMAGE_|CADDY_|SITE_URL|POSTGRES_|S3_|IP_HASH_SALT|CSRF_SECRET|SCRUB_|MEDIA_|LOG_LEVEL|COMPOSE_)/i;
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
  networks?: Record<string, unknown>;
  mem_limit?: string | number;
  environment?: Record<string, string>;
  read_only?: boolean;
  tmpfs?: string[];
  cap_drop?: string[];
  security_opt?: string[];
  healthcheck?: { test?: string[] };
  restart?: string;
  command?: string[];
  depends_on?: Record<string, { condition: string }>;
}

interface Config {
  name: string;
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean; name?: string }>;
  volumes: Record<string, { name?: string }>;
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

beforeAll(() => {
  const version = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
  if (version.status !== 0) throw new Error(`Docker Compose non disponibile: ${version.stderr}`);
  production = config(BASE_ENV);
  staging = config(STAGING_ENV);
  release = config(BASE_ENV, ['release']);
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
      ['admin', 'api', 'caddy', 'db', 'objects', 'objects-init', 'scrub', 'web'].sort(),
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
  it('solo Caddy pubblica porte', () => {
    const published = Object.entries(production.services)
      .filter(([, service]) => (service.ports?.length ?? 0) > 0)
      .map(([name]) => name);
    expect(published).toEqual(['caddy']);
  });

  it('tutte le reti sono interne, salvo quella di Caddy verso l’esterno', () => {
    const external = Object.entries(production.networks)
      .filter(([, network]) => network.internal !== true)
      .map(([name]) => name);
    expect(external).toEqual(['edge']);
    expect(Object.keys(production.services.caddy?.networks ?? {})).toContain('edge');
    for (const [name, service] of Object.entries(production.services)) {
      if (name === 'caddy') continue;
      expect(Object.keys(service.networks ?? {}), name).not.toContain('edge');
    }
  });

  it('database e archivio non stanno sulla rete di Caddy', () => {
    const caddyNetworks = new Set(Object.keys(production.services.caddy?.networks ?? {}));
    for (const name of ['db', 'objects', 'objects-init', 'scrub']) {
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
    const sum = (stack: Config) =>
      LONG_RUNNING.reduce((total, name) => total + bytes(stack.services[name]?.mem_limit), 0);
    expect(sum(production) + sum(staging)).toBeLessThanOrEqual(7 * GIB);
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

describe('produzione e staging separati (W2-6, DR-296)', () => {
  it('progetti, volumi e porte diversi', () => {
    expect(production.name).toBe('amoris-production');
    expect(staging.name).toBe('amoris-staging');
    const volumeNames = (stack: Config) =>
      Object.values(stack.volumes).map((volume) => volume.name);
    const shared = volumeNames(production).filter((name) => volumeNames(staging).includes(name));
    expect(shared).toEqual([]);
    const ports = (stack: Config) => JSON.stringify(stack.services.caddy?.ports);
    expect(ports(production)).not.toBe(ports(staging));
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

  beforeAll(() => {
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
      '-v',
      `${path.join(deployDir, 'caddy')}:/etc/caddy:ro`,
      caddyImage(),
    ]);
    started.push(id);
    const match = /:(\d+)\s*$/m.exec(run(['port', id, '80/tcp']));
    if (!match?.[1]) throw new Error('porta di Caddy non trovata');
    return `http://127.0.0.1:${match[1]}`;
  }

  async function get(base: string, pathname: string): Promise<Response> {
    const deadline = Date.now() + 20_000;
    for (;;) {
      try {
        const response = await fetch(`${base}${pathname}`, { redirect: 'manual' });
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
    const robots = await get(base, '/robots.txt');
    expect(robots.status).toBe(200);
    expect(await robots.text()).toMatch(/^User-agent: \*\s+Disallow: \/\s*$/);
    for (const pathname of ['/', '/una-pagina/', '/admin/', '/api/health/live', '/media/x.jpg']) {
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
