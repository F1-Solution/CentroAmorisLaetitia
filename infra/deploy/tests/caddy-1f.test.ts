import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Caddyfile di produzione (1F-W2 T7, DR-364, DR-365).
 *
 * Avvia l'immagine di Caddy del Compose con il suo `Caddyfile` davanti a un finto servizio che
 * risponde con il proprio nome e il percorso ricevuto, e controlla: instradamento (prefisso
 * `/api` tolto, `/forms` all'API), intestazioni di sicurezza, CSP solo in segnalazione,
 * `Cache-Control` dei media lasciato all'API, HTTP → HTTPS, HSTS e HTTP/2 con il certificato
 * interno che Caddy emette da solo per i nomi `*.localhost`.
 *
 * **Nessun dato reale**: nessun contenitore vede un database o un archivio.
 */

const deployDir = path.resolve(import.meta.dirname, '..');
const SITE_NAME = 'amoris.localhost';

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

function startCaddy(env: string, siteAddress: string): string {
  const id = run([
    'run',
    '-d',
    '--network',
    network,
    '-p',
    '127.0.0.1::80',
    '-p',
    '127.0.0.1::443',
    '-e',
    `AMORIS_ENV=${env}`,
    '-e',
    `CADDY_SITE_ADDRESS=${siteAddress}`,
    '-v',
    `${path.join(deployDir, 'caddy')}:/etc/caddy:ro`,
    caddyImage,
  ]);
  started.push(id);
  return id;
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
    expect(await (await get(base, '/api/health/live')).text()).toBe('api /health/live');
    expect(await (await get(base, '/api/auth/session')).text()).toBe('api /auth/session');
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

describe('HTTPS con il certificato interno (nome *.localhost)', () => {
  let id = '';
  let httpPort = 0;
  let httpsPort = 0;
  let rootCa = '';

  beforeAll(async () => {
    id = startCaddy('production', SITE_NAME);
    httpPort = hostPort(id, '80/tcp');
    httpsPort = hostPort(id, '443/tcp');
    const deadline = Date.now() + 30_000;
    for (;;) {
      const result = spawnSync(
        'docker',
        ['exec', id, 'cat', '/data/caddy/pki/authorities/local/root.crt'],
        { encoding: 'utf8' },
      );
      if (result.status === 0 && result.stdout.includes('BEGIN CERTIFICATE')) {
        rootCa = result.stdout;
        break;
      }
      if (Date.now() > deadline) throw new Error('certificato radice interno non creato');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  });

  /** Richiesta HTTP/2 con il nome del sito (SNI) e la radice interna di Caddy come fiducia. */
  async function h2(
    pathname: string,
  ): Promise<{ headers: http2.IncomingHttpHeaders; body: string }> {
    const deadline = Date.now() + 20_000;
    for (;;) {
      try {
        const result = await new Promise<{ headers: http2.IncomingHttpHeaders; body: string }>(
          (resolve, reject) => {
            const client = http2.connect(`https://${SITE_NAME}:${httpsPort}`, {
              ca: rootCa,
              servername: SITE_NAME,
              lookup: (_host, options, callback) => {
                if ((options as { all?: boolean }).all)
                  callback(null, [{ address: '127.0.0.1', family: 4 }]);
                else callback(null, '127.0.0.1', 4);
              },
            });
            client.on('error', reject);
            const request = client.request({ ':path': pathname });
            let body = '';
            let headers: http2.IncomingHttpHeaders = {};
            request.setEncoding('utf8');
            request.on('response', (h) => (headers = h));
            request.on('data', (chunk: string) => (body += chunk));
            request.on('end', () => {
              client.close();
              resolve({ headers, body });
            });
            request.on('error', reject);
            request.end();
          },
        );
        if (result.headers[':status'] !== 502 || Date.now() > deadline) return result;
      } catch (error) {
        if (Date.now() > deadline) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  it('HTTP risponde con un redirect permanente a HTTPS', async () => {
    // `fetch` ignora l'intestazione Host: serve node:http.
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      http
        .get(
          {
            host: '127.0.0.1',
            port: httpPort,
            path: '/chi-siamo/?a=1',
            headers: { Host: SITE_NAME },
          },
          resolve,
        )
        .on('error', reject);
    });
    response.resume();
    expect(response.statusCode).toBe(308);
    expect(response.headers.location).toBe(`https://${SITE_NAME}/chi-siamo/?a=1`);
  });

  it('HTTPS risponde in HTTP/2 con un certificato valido per il nome', async () => {
    const { headers, body } = await h2('/chi-siamo/');
    expect(headers[':status']).toBe(200);
    expect(body).toBe('web /chi-siamo/');
  });

  it('HSTS con durata breve, senza preload né sottodomini', async () => {
    const { headers } = await h2('/');
    const hsts = String(headers['strict-transport-security'] ?? '');
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(86_400);
    expect(hsts).not.toMatch(/preload|includeSubDomains/i);
  });
});
