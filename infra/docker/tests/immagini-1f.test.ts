import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Prova di comportamento delle immagini di produzione (1F-W2 T4, criteri W2-1 e W2-8).
 *
 * Costruisce `web`, `admin` e `api` con i Dockerfile del repository, poi:
 * - controlla che il contesto di costruzione non porti segreti, sorgenti private o
 *   documenti di lavoro (`.dockerignore` provato, non solo letto);
 * - avvia ogni immagine con file system in sola lettura e `/tmp` in memoria, con valori
 *   sintetici e nessun database raggiungibile, e attende lo stato «healthy» del suo
 *   health check e il 200 della rotta di stato;
 * - controlla utente, file scrivibili e moduli nativi dentro l'immagine.
 *
 * **Nessun dato reale.** I segreti sono sintetici e i contenitori non vedono nessun
 * database. Il controllo completo dei file delle immagini arriva con la CI (T9).
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const TAG = 'prova-t4';

interface AppSpec {
  port: number;
  health: string;
  env: Record<string, string>;
  /** Cartelle che l'applicazione può scrivere, oltre a `/tmp`. */
  writable: string[];
}

const SYNTHETIC_API_ENV = {
  NODE_ENV: 'production',
  API_HOST: '0.0.0.0',
  API_PORT: '3002',
  LOG_LEVEL: 'warn',
  DATABASE_URL: 'postgres://nessuno:nessuno@127.0.0.1:59999/inesistente',
  IP_HASH_SALT: 'sale-sintetico-per-le-immagini-abbastanza-lungo',
  CSRF_SECRET: 'segreto-sintetico-per-le-immagini-abbastanza-lungo',
};

const APPS: Record<'web' | 'admin' | 'api', AppSpec> = {
  web: {
    port: 3000,
    health: '/health/live/',
    env: { API_URL: 'http://127.0.0.1:59999' },
    writable: ['/app/apps/web/.next/cache'],
  },
  admin: {
    port: 3001,
    health: '/admin/health/live',
    env: {},
    writable: ['/app/apps/admin/.next/cache'],
  },
  api: { port: 3002, health: '/health/live', env: SYNTHETIC_API_ENV, writable: [] },
};

type AppName = keyof typeof APPS;
const NAMES = Object.keys(APPS) as AppName[];

function docker(args: string[], input?: string) {
  return spawnSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 1_200_000,
  });
}

function image(app: AppName): string {
  return `amoris-${app}:${TAG}`;
}

/** Esegue un comando nell'immagine, senza il suo avvio normale. */
function inImage(app: AppName, entrypoint: string, args: string[]) {
  return docker(['run', '--rm', '--entrypoint', entrypoint, image(app), ...args]);
}

/** Immagine di base dei Dockerfile, riusata per elencare il contesto di costruzione. */
function baseImage(): string {
  const text = readFileSync(path.join(repoRoot, 'infra', 'docker', 'api.Dockerfile'), 'utf8');
  const match = /^FROM\s+(\S+@sha256:[0-9a-f]{64})/m.exec(text);
  if (!match?.[1]) throw new Error('immagine di base non trovata in api.Dockerfile');
  return match[1];
}

const builds = new Map<AppName, ReturnType<typeof docker>>();
const containers: string[] = [];

beforeAll(() => {
  const version = docker(['version', '--format', '{{.Server.Version}}']);
  if (version.status !== 0) throw new Error(`Docker non raggiungibile: ${version.stderr}`);
  for (const app of NAMES) {
    builds.set(
      app,
      docker(['build', '-f', `infra/docker/${app}.Dockerfile`, '-t', image(app), '.']),
    );
  }
});

afterAll(() => {
  if (containers.length > 0) docker(['rm', '-f', ...containers]);
  docker(['image', 'rm', '-f', ...NAMES.map(image), `amoris-contesto:${TAG}`]);
});

describe('contesto di costruzione (.dockerignore)', () => {
  it('non porta segreti, sorgenti private, documenti di lavoro o cartelle generate', () => {
    const dockerfile = [
      `FROM ${baseImage()}`,
      'COPY . /ctx',
      'RUN cd /ctx && find . -mindepth 1 > /elenco.txt',
    ].join('\n');
    const build = docker(['build', '-f', '-', '-t', `amoris-contesto:${TAG}`, '.'], dockerfile);
    expect(build.status, build.stderr.slice(-2000)).toBe(0);
    const list = docker(['run', '--rm', `amoris-contesto:${TAG}`, 'cat', '/elenco.txt']);
    expect(list.status).toBe(0);
    const paths = list.stdout.split('\n').filter((line) => line.length > 0);

    const forbidden =
      /^\.\/(?:\.git|source-private|source-readonly|\.reference|\.superpowers|\.planning|coverage|test-results|\.claude|\.playwright-mcp)(?:\/|$)|\/node_modules(?:\/|$)|\/\.env(?!\.example$)[^/]*$|\.(?:pem|key|pfx)$/;
    const found = paths.filter((entry) => forbidden.test(entry));
    expect(found.slice(0, 5), `${found.length} percorsi vietati`).toEqual([]);
    expect(paths).toContain('./pnpm-lock.yaml');
    expect(paths).toContain('./.env.example');
  });
});

describe.each(NAMES)('immagine %s', (app) => {
  const spec = APPS[app];

  it('si costruisce dal Dockerfile del repository', () => {
    const build = builds.get(app);
    expect(build?.status, build?.stderr.slice(-4000)).toBe(0);
  });

  it('dichiara un utente non root, NODE_ENV=production e un health check', () => {
    const inspect = docker(['image', 'inspect', image(app), '--format', '{{json .Config}}']);
    expect(inspect.status, inspect.stderr).toBe(0);
    const config = JSON.parse(inspect.stdout) as {
      User: string;
      Env: string[];
      Healthcheck?: { Test: string[] };
    };
    expect(['', 'root', '0']).not.toContain(config.User.split(':')[0]);
    expect(config.Env).toContain('NODE_ENV=production');
    expect(config.Healthcheck?.Test.length).toBeGreaterThan(0);
  });

  it('gira con un uid diverso da 0', () => {
    const result = inImage(app, 'id', ['-u']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).not.toBe('0');
  });

  it("l'utente scrive solo nelle cartelle dichiarate", () => {
    const result = inImage(app, 'sh', [
      '-c',
      'find / -xdev -writable -not -path "/proc/*" -not -path "/sys/*" -not -path "/dev/*" -not -path "/tmp" -not -path "/tmp/*" -not -path "/var/tmp" -not -path "/var/tmp/*" -not -path "/run/lock" -not -path "/var/lock" -print 2>/dev/null; echo FINE-ELENCO',
    ]);
    // Senza il marcatore il comando non è partito (immagine assente): la prova non vale.
    expect(result.stdout, result.stderr).toContain('FINE-ELENCO');
    const writable = result.stdout
      .split('\n')
      .filter((entry) => entry.length > 0 && entry !== 'FINE-ELENCO')
      .filter(
        (entry) => !spec.writable.some((dir) => entry === dir || entry.startsWith(`${dir}/`)),
      );
    expect(writable.slice(0, 10)).toEqual([]);
  });

  it("non contiene file d'ambiente né sorgenti private nell'applicazione", () => {
    const result = inImage(app, 'sh', [
      '-c',
      'find /app -path "*/node_modules" -prune -o \\( -name ".env*" -o -name "source-private" -o -name ".git" -o -name "*.pem" \\) -print',
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('parte in sola lettura, diventa «healthy» e risponde alla rotta di stato', async () => {
    const envArgs = Object.entries(spec.env).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
    const extraTmpfs = spec.writable.flatMap((dir) => ['--tmpfs', `${dir}:mode=1777`]);
    const run = docker([
      'run',
      '-d',
      '--read-only',
      '--tmpfs',
      '/tmp:mode=1777',
      ...extraTmpfs,
      '--health-interval',
      '2s',
      '--health-start-period',
      '1s',
      '-p',
      `127.0.0.1::${spec.port}`,
      ...envArgs,
      image(app),
    ]);
    expect(run.status, run.stderr).toBe(0);
    const id = run.stdout.trim();
    containers.push(id);

    let health = '';
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      health = docker(['inspect', id, '--format', '{{.State.Health.Status}}']).stdout.trim();
      if (health === 'healthy' || health === 'unhealthy') break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const logs = docker(['logs', '--tail', '40', id]);
    expect(health, `${logs.stdout}\n${logs.stderr}`).toBe('healthy');

    const mapped =
      docker(['port', id, String(spec.port)])
        .stdout.trim()
        .split('\n')[0] ?? '';
    const response = await fetch(`http://${mapped}${spec.health}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
    if (app === 'admin') expect(response.headers.get('x-robots-tag')).toContain('noindex');
    if (app === 'web') {
      const font = await fetch(`http://${mapped}/fonts/open-sans/OFL.txt`);
      expect(font.status).toBe(200);
    }
  });
});

describe('contenuto specifico', () => {
  it.each(['web', 'admin'] as const)('%s porta i file statici di Next', (app) => {
    const result = inImage(app, 'sh', ['-c', `ls /app/apps/${app}/.next/static | head -1`]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).not.toBe('');
  });

  it("l'API carica sharp e @node-rs/argon2 e porta migrazioni e account:create", () => {
    const script = [
      "const sharp = (await import('sharp')).default;",
      "const { hash } = await import('@node-rs/argon2');",
      'const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toBuffer();',
      "const h = await hash('password-sintetica');",
      "console.log(png.length > 0 && h.startsWith('$argon2id$') ? 'nativi-ok' : 'nativi-ko');",
    ].join('\n');
    const result = inImage('api', 'node', ['--input-type=module', '-e', script]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('nativi-ok');

    const files = inImage('api', 'sh', [
      '-c',
      'ls /app/server.js /app/bin/migrate.js /app/bin/account-create.js /app/drizzle/meta/_journal.json',
    ]);
    expect(files.status, files.stderr).toBe(0);
  });
});
