import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Caddyfile di produzione (1F-W2 T7, DR-364, DR-365).
 *
 * Avvia l'immagine di Caddy del Compose con il suo `Caddyfile` davanti a un finto servizio che
 * risponde con il proprio nome e il percorso ricevuto, e controlla: instradamento (prefisso
 * `/api` tolto, `/forms` all'API), intestazioni di sicurezza, CSP solo in segnalazione,
 * `Cache-Control` dei media lasciato all'API e indirizzo del visitatore (DR-409). HTTPS, HSTS e
 * HTTP/2 stanno nell'ingresso comune: li prova `ingresso-1f.test.ts`.
 *
 * **Nessun dato reale**: nessun contenitore vede un database o un archivio.
 */

const deployDir = path.resolve(import.meta.dirname, '..');
/** Sottorete dell'ingresso nelle prove: non contiene il peer che arriva dall'host. */
const INGRESS_SUBNET = '10.213.88.0/24';

const caddyImage = (() => {
  const match = /^\s+image: (caddy:\S+)$/m.exec(
    readFileSync(path.join(deployDir, 'compose.yml'), 'utf8'),
  );
  if (!match?.[1]) throw new Error('immagine di Caddy non trovata nel Compose');
  return match[1];
})();

/** Finto sito, area e API: ognuno risponde «<nome> <percorso>», con le intestazioni di un'app. */
const FAKE_UPSTREAMS = `{
	admin off
}
:3000 {
	header X-Robots-Tag "all"
	@eco path /eco
	respond @eco "web {path} xff=[{header.X-Forwarded-For}] proto=[{header.X-Forwarded-Proto}] host=[{host}] xri=[{header.X-Real-IP}] fwd=[{header.Forwarded}] "
	respond "web {path}"
}
:3001 {
	respond "admin {path}"
}
:3002 {
	header Cache-Control "no-cache"
	header ETag "\\"impronta-1\\""
	header Content-Type "image/jpeg"
	respond "api {path}"
}
`;

const started: string[] = [];
const network = `amoris-caddy-t7-${process.pid}`;
let fakeDir = '';

function run(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 300_000 });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function hostPort(id: string, containerPort: string): number {
  const match = /:(\d+)\s*$/m.exec(run(['port', id, containerPort]));
  if (!match?.[1]) throw new Error(`porta ${containerPort} non trovata`);
  return Number(match[1]);
}

function startCaddy(
  env: string,
  siteAddress: string,
  extraEnv: Readonly<Record<string, string>> = {},
): string {
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
    `INGRESS_SUBNET=${INGRESS_SUBNET}`,
    '-e',
    `CADDY_SITE_ADDRESS=${siteAddress}`,
    ...Object.entries(extraEnv).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    '-v',
    `${path.join(deployDir, 'caddy')}:/etc/caddy:ro`,
    caddyImage,
  ]);
  started.push(id);
  return id;
}

/** Hash bcrypt di una password sintetica, generato al volo con Caddy: nessun hash nel repository. */
function syntheticHash(password: string): string {
  return run(['run', '--rm', caddyImage, 'caddy', 'hash-password', '--plaintext', password]);
}

async function get(base: string, pathname: string, headers: Record<string, string> = {}) {
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      const response = await fetch(`${base}${pathname}`, { redirect: 'manual', headers });
      // All'avvio il finto servizio può non essere ancora pronto.
      if (response.status !== 502 || Date.now() > deadline) return response;
    } catch (error) {
      if (Date.now() > deadline) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

beforeAll(() => {
  fakeDir = mkdtempSync(path.join(tmpdir(), 'amoris-caddy-t7-'));
  writeFileSync(path.join(fakeDir, 'Caddyfile'), FAKE_UPSTREAMS);
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
      '-v',
      `${fakeDir}:/etc/caddy:ro`,
      caddyImage,
    ]),
  );
});

afterAll(() => {
  if (started.length > 0) spawnSync('docker', ['rm', '-f', ...started]);
  spawnSync('docker', ['network', 'rm', network]);
  if (fakeDir) rmSync(fakeDir, { recursive: true, force: true });
});

describe('instradamento e intestazioni (HTTP, indirizzo :80)', () => {
  let base = '';

  beforeAll(() => {
    base = `http://127.0.0.1:${hostPort(startCaddy('production', ':80'), '80/tcp')}`;
  });

  it('/api arriva all’API senza il prefisso, che risponde dalla radice', async () => {
    expect(await (await get(base, '/api/auth/session')).text()).toBe('api /auth/session');
    expect(await (await get(base, '/api/auth/me')).text()).toBe('api /auth/me');
    expect(await (await get(base, '/api/accounts')).text()).toBe('api /accounts');
  });

  it('T6j: /api/openapi.json e /api/health/* rispondono 404 da Caddy, comprese le varianti di percorso', async () => {
    for (const pathname of [
      '/api/openapi.json',
      '/api/openapi.json/',
      '/api/health/ready',
      '/api/health/live',
      '/api/health',
      '/api/health/',
      '/api/health/qualunque',
      '/api/HEALTH/ready',
      '/api/Openapi.json',
      '/api/./health/ready',
      '/api//health/ready',
      '/api/%68ealth/ready',
    ]) {
      const response = await get(base, pathname);
      expect(response.status, pathname).toBe(404);
      expect(await response.text(), pathname).not.toMatch(/^api /);
    }
  });

  it('/forms e /media vanno all’API, /admin all’area, il resto al sito', async () => {
    expect(await (await get(base, '/forms/contatti/submissions')).text()).toBe(
      'api /forms/contatti/submissions',
    );
    expect(await (await get(base, '/media/2024/01/foto.jpg')).text()).toBe(
      'api /media/2024/01/foto.jpg',
    );
    expect(await (await get(base, '/admin/contenuti')).text()).toBe('admin /admin/contenuti');
    expect(await (await get(base, '/chi-siamo/')).text()).toBe('web /chi-siamo/');
  });

  it('Permissions-Policy nega le funzioni che il sito non usa', async () => {
    const policy = (await get(base, '/')).headers.get('permissions-policy') ?? '';
    for (const feature of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()']) {
      expect(policy).toContain(feature);
    }
    // Gli embed video devono poter andare a schermo intero.
    expect(policy).not.toContain('fullscreen');
  });

  it('la CSP è solo in segnalazione (DR-364), con gli embed e senza raccolta', async () => {
    const response = await get(base, '/');
    expect(response.headers.get('content-security-policy')).toBeNull();
    const csp = response.headers.get('content-security-policy-report-only') ?? '';
    const directives = new Map(
      csp
        .split(';')
        .map((part) => part.trim().split(/\s+/))
        .filter((parts) => parts[0])
        .map((parts) => [parts[0], parts.slice(1)] as const),
    );
    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'self'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);
    expect(directives.get('script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directives.get('frame-src')).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://www.youtube-nocookie.com',
        'https://www.youtube.com',
        'https://player.vimeo.com',
        'https://www.google.com',
      ]),
    );
    expect(directives.has('report-uri')).toBe(false);
    expect(directives.has('report-to')).toBe(false);
    // Vale anche per l'area.
    expect((await get(base, '/admin/')).headers.get('content-security-policy-report-only')).toBe(
      csp,
    );
  });

  it('i media tengono il Cache-Control e l’impronta dell’API (DR-365)', async () => {
    const response = await get(base, '/media/foto.jpg', { 'Accept-Encoding': 'gzip, zstd' });
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('etag')).toBe('"impronta-1"');
    expect(response.headers.get('content-encoding')).toBeNull();
  });

  it('le intestazioni di oggi restano', async () => {
    const home = await get(base, '/');
    expect(home.headers.get('x-content-type-options')).toBe('nosniff');
    expect(home.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(home.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(home.headers.get('server')).toBeNull();
    expect((await get(base, '/admin/')).headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});

describe('indirizzo del visitatore (DR-409): da fuori della rete dell’ingresso nessuno impone un indirizzo', () => {
  let base = '';

  beforeAll(() => {
    base = `http://127.0.0.1:${hostPort(startCaddy('production', ':80'), '80/tcp')}`;
  });

  it('un X-Forwarded-For, X-Real-IP o Forwarded dichiarato dal client non arriva all’applicazione', async () => {
    const response = await get(base, '/eco', {
      'X-Forwarded-For': '6.6.6.6, 7.7.7.7',
      'X-Real-IP': '9.9.9.9',
      Forwarded: 'for=8.8.8.8',
      'X-Forwarded-Proto': 'https',
    });
    const seen = await response.text();
    expect(seen).not.toMatch(/6\.6\.6\.6|7\.7\.7\.7|9\.9\.9\.9|8\.8\.8\.8/);
    // Unica voce: l'indirizzo del peer, senza virgole.
    expect(seen).toMatch(/xff=\[\d+\.\d+\.\d+\.\d+\] /);
    expect(seen).toContain('xri=[]');
    expect(seen).toContain('fwd=[]');
    // Il peer non è l'ingresso: la dichiarazione di schema non vale.
    expect(seen).toContain('proto=[http]');
  });
});

describe('staging protetto da password (DR-375, rilievo R1)', () => {
  const USER = 'redattore-prova';
  const PASSWORD = 'password-sintetica-di-prova';
  const PATHS = [
    '/',
    '/chi-siamo/',
    '/admin',
    '/admin/contenuti',
    '/api/openapi.json',
    '/api/health/live',
    '/api/auth/me',
    '/media/x',
    '/forms/contatti/submissions',
    '/robots.txt',
  ];
  let hash = '';
  let base = '';
  let id = '';

  const basic = (user: string, password: string) => ({
    Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
  });

  beforeAll(() => {
    hash = syntheticHash(PASSWORD);
    id = startCaddy('staging', ':80', {
      STAGING_BASIC_AUTH_USER: USER,
      STAGING_BASIC_AUTH_HASH: hash,
    });
    base = `http://127.0.0.1:${hostPort(id, '80/tcp')}`;
  });

  it('senza credenziali ogni percorso risponde 401 con WWW-Authenticate', async () => {
    for (const pathname of PATHS) {
      const response = await fetch(`${base}${pathname}`, { redirect: 'manual' });
      expect(response.status, pathname).toBe(401);
      expect(response.headers.get('www-authenticate'), pathname).toMatch(/^Basic/i);
      expect(await response.text(), pathname).not.toMatch(/^(web|admin|api) /);
    }
  });

  it('con credenziali sbagliate (utente o password) risponde 401', async () => {
    for (const headers of [basic(USER, 'sbagliata'), basic('altro', PASSWORD), basic('', '')]) {
      for (const pathname of ['/', '/admin', '/api/openapi.json', '/robots.txt']) {
        const response = await fetch(`${base}${pathname}`, { redirect: 'manual', headers });
        expect(response.status, pathname).toBe(401);
      }
    }
  });

  it('con le credenziali giuste la richiesta arriva all’applicazione', async () => {
    const headers = basic(USER, PASSWORD);
    expect(await (await get(base, '/chi-siamo/', headers)).text()).toBe('web /chi-siamo/');
    expect(await (await get(base, '/admin/contenuti', headers)).text()).toBe(
      'admin /admin/contenuti',
    );
    expect(await (await get(base, '/api/auth/me', headers)).text()).toBe('api /auth/me');
    expect((await get(base, '/api/openapi.json', headers)).status).toBe(404);
    expect(await (await get(base, '/media/x', headers)).text()).toBe('api /media/x');
    expect(await (await get(base, '/forms/a/submissions', headers)).text()).toBe(
      'api /forms/a/submissions',
    );
    const robots = await get(base, '/robots.txt', headers);
    expect(await robots.text()).toMatch(/Disallow: \//);
    expect(robots.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('il controllo di salute interno risponde senza credenziali', () => {
    const result = spawnSync(
      'docker',
      ['exec', id, 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:2020/health/live'],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
  });

  it('la produzione non chiede nessuna autenticazione', async () => {
    const production = `http://127.0.0.1:${hostPort(startCaddy('production', ':80'), '80/tcp')}`;
    for (const pathname of ['/', '/admin', '/api/auth/me', '/robots.txt']) {
      const response = await get(production, pathname);
      expect(response.status, pathname).toBe(200);
      expect(response.headers.get('www-authenticate'), pathname).toBeNull();
    }
  });

  it.each([
    ['utente e hash mancanti', {}],
    ['utente e hash vuoti', { STAGING_BASIC_AUTH_USER: '', STAGING_BASIC_AUTH_HASH: '' }],
    ['hash mancante', { STAGING_BASIC_AUTH_USER: USER }],
    ['utente mancante', { STAGING_BASIC_AUTH_HASH: 'x' }],
    ['hash non valido', { STAGING_BASIC_AUTH_USER: USER, STAGING_BASIC_AUTH_HASH: 'non-un-hash' }],
  ])('con %s Caddy non parte (fallisce chiuso)', async (_name, extra) => {
    const failing = startCaddy('staging', ':80', extra);
    const deadline = Date.now() + 20_000;
    let running = 'true';
    while (Date.now() < deadline) {
      running = run(['inspect', '-f', '{{.State.Running}}', failing]);
      if (running === 'false') break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(running).toBe('false');
    expect(run(['inspect', '-f', '{{.State.ExitCode}}', failing])).not.toBe('0');
  });
});
