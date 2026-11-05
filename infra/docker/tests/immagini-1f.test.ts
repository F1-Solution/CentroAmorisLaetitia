import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildPdf, MARKERS } from '../../../apps/api/tests/_support/syntheticFiles.js';
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
 * - controlla utente, file scrivibili e moduli nativi dentro l'immagine;
 * - per la pulizia (DR-359): PDF e MP4 sintetici ripuliti attraverso il contenitore su una
 *   rete interna, nessuna uscita verso Internet, file oltre il limite rifiutati.
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

const APPS: Record<'web' | 'admin' | 'api' | 'scrub', AppSpec> = {
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
  scrub: {
    port: 3003,
    health: '/health/live',
    env: { SCRUB_SERVICE_TOKEN: 'gettone-sintetico-del-servizio-di-pulizia-1f' },
    writable: [],
  },
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

interface BuildResult {
  readonly status: number | null;
  readonly stderr: string;
}

/** Costruzione asincrona: un `spawnSync` di minuti blocca il processo delle prove e Vitest scade. */
function dockerBuild(args: string[]): Promise<BuildResult> {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { cwd: repoRoot, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      // Basta la coda del registro di costruzione per capire un errore.
      stderr = (stderr + chunk.toString()).slice(-16_000);
    });
    child.on('error', (error) => resolve({ status: null, stderr: String(error) }));
    child.on('close', (status) => resolve({ status, stderr }));
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

const builds = new Map<AppName, BuildResult>();
/** Rete Docker senza uscita verso Internet, come quella della pulizia in produzione (DR-359). */
const NETWORK = `amoris-pulizia-${TAG}`;
const containers: string[] = [];

beforeAll(async () => {
  const version = docker(['version', '--format', '{{.Server.Version}}']);
  if (version.status !== 0) throw new Error(`Docker non raggiungibile: ${version.stderr}`);
  for (const app of NAMES) {
    builds.set(
      app,
      await dockerBuild(['build', '-f', `infra/docker/${app}.Dockerfile`, '-t', image(app), '.']),
    );
  }
});

afterAll(() => {
  if (containers.length > 0) docker(['rm', '-f', ...containers]);
  docker(['image', 'rm', '-f', ...NAMES.map(image), `amoris-contesto:${TAG}`]);
  docker(['network', 'rm', NETWORK]);
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

describe('pulizia su rete interna (DR-359, DR-362, criterio W2-5)', () => {
  const TOKEN = APPS.scrub.env.SCRUB_SERVICE_TOKEN ?? '';
  const LIMIT = 1_000_000;
  let service = '';

  beforeAll(() => {
    docker(['network', 'rm', NETWORK]);
    const network = docker(['network', 'create', '--internal', NETWORK]);
    if (network.status !== 0) throw new Error(network.stderr);
    const run = docker([
      'run',
      '-d',
      '--read-only',
      '--tmpfs',
      '/tmp:size=256m,mode=1777',
      '--memory',
      '1g',
      '--network',
      NETWORK,
      '--network-alias',
      'scrub',
      '-e',
      `SCRUB_SERVICE_TOKEN=${TOKEN}`,
      '-e',
      `SCRUB_MAX_BODY_BYTES=${LIMIT}`,
      image('scrub'),
    ]);
    if (run.status !== 0) throw new Error(run.stderr);
    service = run.stdout.trim();
    containers.push(service);
  });

  /** Esegue uno script come cliente sulla stessa rete interna, con l'immagine della pulizia. */
  function client(script: string, input?: Buffer) {
    return spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '-i',
        '--network',
        NETWORK,
        '--tmpfs',
        '/tmp:mode=1777',
        '-e',
        `TOKEN=${TOKEN}`,
        '--entrypoint',
        'node',
        image('scrub'),
        '--input-type=module',
        '-e',
        script,
      ],
      { cwd: repoRoot, input, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 },
    );
  }

  /** Ultima riga JSON stampata dal cliente. */
  const lastJson = (stdout: string): unknown =>
    JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}');

  /** Attende che il servizio risponda dalla rete interna. */
  const WAIT = [
    'for (let i = 0; i < 60; i++) {',
    "  try { if ((await fetch('http://scrub:3003/health/live')).ok) break; } catch {}",
    '  await new Promise((r) => setTimeout(r, 500));',
    '}',
  ].join('\n');

  const POST = (type: string, auth = true) =>
    `{ method: 'POST', body, headers: { ${auth ? "authorization: 'Bearer ' + process.env.TOKEN, " : ''}'content-type': '${type}' } }`;

  it('i limiti dichiarati sono applicati al contenitore', () => {
    const inspect = docker(['inspect', service, '--format', '{{json .HostConfig}}']);
    expect(inspect.status, inspect.stderr).toBe(0);
    const host = JSON.parse(inspect.stdout) as {
      Memory: number;
      ReadonlyRootfs: boolean;
      Tmpfs: Record<string, string>;
    };
    expect(host.Memory).toBe(1024 * 1024 * 1024);
    expect(host.ReadonlyRootfs).toBe(true);
    expect(host.Tmpfs['/tmp']).toContain('size=256m');
    const user = docker(['exec', service, 'id', '-u']);
    expect(user.stdout.trim()).not.toBe('0');
  });

  it('porta qpdf 12.4.2, ffmpeg e ffprobe 9.0.2 e nessun node_modules', () => {
    const result = inImage('scrub', 'sh', [
      '-c',
      '$QPDF_PATH --version | head -n 1; $FFMPEG_PATH -version | head -n 1; $FFPROBE_PATH -version | head -n 1; ls /app',
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('qpdf version 12.4.2');
    expect(result.stdout).toMatch(/ffmpeg version n9\.0\.2/);
    expect(result.stdout).toMatch(/ffprobe version n9\.0\.2/);
    expect(result.stdout).not.toContain('node_modules');
  });

  it('ripulisce un PDF sintetico attraverso il contenitore', () => {
    const script = [
      "import { readFileSync } from 'node:fs';",
      WAIT,
      'const body = readFileSync(0);',
      `const r = await fetch('http://scrub:3003/scrub', ${POST('application/pdf')});`,
      'const out = Buffer.from(await r.arrayBuffer());',
      `console.log(JSON.stringify({ status: r.status, pdf: out.subarray(0, 5).toString('latin1'), marker: out.includes('${MARKERS.author}') }));`,
    ].join('\n');
    const result = client(script, buildPdf({ withMetadata: true }));
    expect(result.status, result.stderr).toBe(0);
    expect(lastJson(result.stdout)).toEqual({ status: 200, pdf: '%PDF-', marker: false });
  });

  it('ripulisce un MP4 sintetico attraverso il contenitore', () => {
    const script = [
      "import { execFileSync } from 'node:child_process';",
      "import { readFileSync } from 'node:fs';",
      WAIT,
      // MP4 sintetico creato dal ffmpeg dell'immagine, con un metadato da togliere.
      "execFileSync(process.env.FFMPEG_PATH, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=64x64:rate=10',",
      "  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-metadata', 'artist=ARTISTA-SINTETICO', '-f', 'mp4', '/tmp/in.mp4']);",
      "const body = readFileSync('/tmp/in.mp4');",
      `const r = await fetch('http://scrub:3003/scrub', ${POST('video/mp4')});`,
      'const out = Buffer.from(await r.arrayBuffer());',
      "console.log(JSON.stringify({ before: body.includes('ARTISTA-SINTETICO'), status: r.status, size: out.length > 0, marker: out.includes('ARTISTA-SINTETICO') }));",
    ].join('\n');
    const result = client(script);
    expect(result.status, result.stderr).toBe(0);
    expect(lastJson(result.stdout)).toEqual({
      before: true,
      status: 200,
      size: true,
      marker: false,
    });
  });

  it('rifiuta con 413 un file oltre il limite e con 401 chi non ha il gettone', () => {
    const script = [
      WAIT,
      `let body = Buffer.alloc(${LIMIT + 1}, 0x20);`,
      `const over = await fetch('http://scrub:3003/scrub', ${POST('application/pdf')});`,
      "body = '%PDF-1.7';",
      `const anon = await fetch('http://scrub:3003/scrub', ${POST('application/pdf', false)});`,
      'console.log(JSON.stringify({ over: over.status, anon: anon.status }));',
    ].join('\n');
    const result = client(script);
    expect(result.status, result.stderr).toBe(0);
    expect(lastJson(result.stdout)).toEqual({ over: 413, anon: 401 });
  });

  it('dal contenitore nessuna connessione verso Internet', () => {
    const dns = docker(['exec', service, 'getent', 'hosts', 'example.com']);
    expect(dns.status).not.toBe(0);
    const ip = docker([
      'exec',
      service,
      'node',
      '-e',
      "fetch('http://1.1.1.1', { signal: AbortSignal.timeout(5000) }).then(() => process.exit(0), () => process.exit(7))",
    ]);
    expect(ip.status).toBe(7);
  });
});
