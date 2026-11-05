import { createServer as createNetServer, type AddressInfo } from 'node:net';
import { request as httpRequest, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { scrubToolsOf } from '../src/config.js';
import {
  ScrubTooLargeError,
  ScrubUnavailableError,
  ScrubUnreadableError,
} from '../src/modules/media/scrub.js';
import { SERVICE_MARGIN_MS, scrubViaService } from '../src/modules/media/scrubClient.js';
import { createScrubServer } from '../src/modules/media/scrubService.js';
import {
  createHarness,
  signIn,
  testConfig,
  type Harness,
  type Signed,
} from './_support/harness.js';
import {
  MARKERS,
  assertToolsInstalled,
  buildMp4,
  buildPdf,
  contains,
  probeMp4,
} from './_support/syntheticFiles.js';

/**
 * Servizio di pulizia su rete interna (1F-W2 T5, DR-359, DR-361, DR-362).
 *
 * Il servizio gira qui nello stesso processo, con i programmi veri: l'API gli invia il file e
 * riceve quello ripulito, con gli stessi esiti della pulizia locale. Solo file sintetici.
 */

const TOKEN = 'gettone-sintetico-del-servizio-di-pulizia-1f';
const MAX_BODY = 4 * 1024 * 1024;

let harness: Harness;
let server: Server;
let url: string;

beforeAll(async () => {
  await assertToolsInstalled();
  harness = await createHarness('api_scrub_service');
  const tools = scrubToolsOf(harness.config);
  server = createScrubServer({ token: TOKEN, tools, maxBodyBytes: MAX_BODY });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 180_000);

afterAll(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  await harness?.teardown();
});

const target = (token = TOKEN) => ({ url, token });
const timeouts = { pdfTimeoutMs: 30_000, videoTimeoutMs: 120_000 };

async function post(path: string, init: { token?: string; type?: string; body?: Buffer }) {
  return fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      ...(init.token !== undefined ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.type !== undefined ? { 'content-type': init.type } : {}),
    },
    body: init.body,
  });
}

describe('servizio di pulizia: protocollo', () => {
  it('risponde 200 a /health/live senza gettone', async () => {
    const response = await fetch(`${url}/health/live`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it.each([
    ['senza gettone', undefined],
    ['con un gettone sbagliato', 'gettone-sbagliato-ma-abbastanza-lungo-per-la-prova'],
  ])('%s risponde 401 e non ripulisce il file', async (_name, token) => {
    const response = await post('/scrub', { token, type: 'application/pdf', body: buildPdf() });
    expect(response.status).toBe(401);
  });

  it('lo schema «bearer» minuscolo o un gettone vuoto sono 401', async () => {
    for (const authorization of [`bearer ${TOKEN}`, 'Bearer ', 'Bearer', TOKEN]) {
      const response = await fetch(`${url}/scrub`, {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/pdf' },
        body: buildPdf(),
      });
      expect(response.status, authorization.slice(0, 7)).toBe(401);
    }
  });

  it('un file a pezzi, senza lunghezza dichiarata, oltre il limite del servizio è 413', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(`${url}/scrub`, {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/pdf' },
      });
      request.on('response', (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      request.on('error', reject);
      const piece = Buffer.alloc(256 * 1024, 0x20);
      for (let sent = 0; sent <= MAX_BODY; sent += piece.length) request.write(piece);
      request.end();
    });
    expect(status).toBe(413);
  });

  it('con una pulizia in corso un secondo file è 503 «occupato»', async () => {
    // Prima richiesta: il corpo non finisce mai, quindi tiene occupato l'unico posto.
    const first = httpRequest(`${url}/scrub`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/pdf' },
    });
    first.on('error', () => {});
    first.write(Buffer.from('%PDF-1.7\n'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      const second = await post('/scrub', {
        token: TOKEN,
        type: 'application/pdf',
        body: buildPdf(),
      });
      expect(second.status).toBe(503);
      expect(await second.json()).toEqual({ error: 'busy' });
      const error = await scrubViaService('application/pdf', buildPdf(), target(), timeouts).catch(
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(ScrubUnavailableError);
    } finally {
      first.destroy();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    // Liberato il posto, la pulizia riprende.
    const after = await post('/scrub', { token: TOKEN, type: 'application/pdf', body: buildPdf() });
    expect(after.status).toBe(200);
  });

  it('un servizio senza programmi risponde 503 e il cliente lo legge come non disponibile', async () => {
    const broken = createScrubServer({
      token: TOKEN,
      tools: { ...scrubToolsOf(harness.config), qpdfPath: 'qpdf-che-non-esiste-xyz' },
      maxBodyBytes: MAX_BODY,
    });
    await new Promise<void>((resolve) => broken.listen(0, '127.0.0.1', resolve));
    try {
      const brokenUrl = `http://127.0.0.1:${(broken.address() as AddressInfo).port}`;
      const raw = await fetch(`${brokenUrl}/scrub`, {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/pdf' },
        body: buildPdf(),
      });
      expect(raw.status).toBe(503);
      expect((await raw.json()).trace).toMatchObject({ tool: 'qpdf', exitCode: null });
      const error = await scrubViaService(
        'application/pdf',
        buildPdf(),
        { url: brokenUrl, token: TOKEN },
        timeouts,
      ).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ScrubUnavailableError);
      expect((error as ScrubUnavailableError).trace.tool).toBe('qpdf');
    } finally {
      await new Promise<void>((resolve) => broken.close(() => resolve()));
    }
  });

  it('un tipo non ripulibile è 415', async () => {
    const response = await post('/scrub', { token: TOKEN, type: 'image/png', body: buildPdf() });
    expect(response.status).toBe(415);
  });

  it('un percorso sconosciuto è 404', async () => {
    const response = await post('/altro', { token: TOKEN, type: 'application/pdf' });
    expect(response.status).toBe(404);
  });

  it('un file oltre il limite del servizio è 413', async () => {
    const response = await post('/scrub', {
      token: TOKEN,
      type: 'application/pdf',
      body: Buffer.alloc(MAX_BODY + 1, 0x20),
    });
    expect(response.status).toBe(413);
  });
});

describe('servizio di pulizia: cliente dell API', () => {
  it('ripulisce un PDF: nessun metadato sopravvive', async () => {
    const cleaned = await scrubViaService(
      'application/pdf',
      buildPdf({ withMetadata: true }),
      target(),
      timeouts,
    );
    expect(cleaned.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    for (const marker of [MARKERS.author, MARKERS.producer, MARKERS.xmp]) {
      expect(contains(cleaned, marker)).toBe(false);
    }
  });

  it('ripulisce un MP4: tracce intatte, metadati assenti', async () => {
    const cleaned = await scrubViaService(
      'video/mp4',
      await buildMp4({ withMetadata: true }),
      target(),
      timeouts,
    );
    const probe = await probeMp4(cleaned);
    expect(probe.types).toContain('video');
    expect(probe.duration).toBeGreaterThan(0);
    expect(contains(cleaned, MARKERS.artist)).toBe(false);
    expect(contains(cleaned, MARKERS.location)).toBe(false);
  });

  it('un file illeggibile è ScrubUnreadableError con la traccia del programma', async () => {
    const error = await scrubViaService(
      'application/pdf',
      Buffer.from('%PDF-1.7\nnon è un PDF\n'),
      target(),
      timeouts,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ScrubUnreadableError);
    expect((error as ScrubUnreadableError).trace.tool).toBe('qpdf');
  });

  it('un MP4 con audio fuori elenco è ScrubUnreadableError da ffprobe', async () => {
    const error = await scrubViaService(
      'video/mp4',
      await buildMp4({ audioCodec: 'mp3', withMetadata: false }),
      target(),
      timeouts,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ScrubUnreadableError);
    expect((error as ScrubUnreadableError).trace.tool).toBe('ffprobe');
  });

  it('un file ripulito oltre il limite del suo tipo è ScrubTooLargeError', async () => {
    const error = await scrubViaService(
      'application/pdf',
      buildPdf({ pages: 3 }),
      target(),
      timeouts,
      10,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ScrubTooLargeError);
  });

  it('un file oltre il limite del servizio è ScrubTooLargeError', async () => {
    const error = await scrubViaService(
      'application/pdf',
      Buffer.alloc(MAX_BODY + 1, 0x20),
      target(),
      timeouts,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ScrubTooLargeError);
  });

  it('un gettone sbagliato è ScrubUnavailableError', async () => {
    const error = await scrubViaService(
      'application/pdf',
      buildPdf(),
      target('gettone-sbagliato-ma-abbastanza-lungo-per-la-prova'),
      timeouts,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ScrubUnavailableError);
  });

  it('un servizio che non risponde entro il tempo del programma più il margine è ScrubUnavailableError', async () => {
    // Accetta la connessione e non risponde mai.
    const silent = createNetServer(() => {});
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const port = (silent.address() as AddressInfo).port;
    try {
      const started = Date.now();
      const error = await scrubViaService(
        'application/pdf',
        buildPdf(),
        { url: `http://127.0.0.1:${port}`, token: TOKEN },
        { pdfTimeoutMs: 1, videoTimeoutMs: 1 },
      ).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ScrubUnavailableError);
      expect(Date.now() - started).toBeGreaterThanOrEqual(SERVICE_MARGIN_MS - 100);
    } finally {
      silent.close();
    }
  }, 20_000);
});

describe('caricamento attraverso il servizio (POST /media)', () => {
  function multipartOf(who: Signed, fileName: string, body: Buffer) {
    const boundary = '----prova-sintetica';
    const head = Buffer.from(
      `--${boundary}\r\n` +
        `content-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `content-type: application/octet-stream\r\n\r\n`,
    );
    return {
      payload: Buffer.concat([head, body, Buffer.from(`\r\n--${boundary}--\r\n`)]),
      headers: { ...who.writeHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` },
    };
  }

  it('il PDF arriva ripulito nell archivio anche senza programmi locali', async () => {
    const config = testConfig(harness.config.DATABASE_URL, {
      SCRUB_SERVICE_URL: url,
      SCRUB_SERVICE_TOKEN: TOKEN,
      // Nessun programma locale: se l'API li usasse, il caricamento fallirebbe.
      QPDF_PATH: 'qpdf-che-non-esiste-xyz',
    });
    const app = await buildApp(config, { objectStore: harness.store });
    await app.ready();
    try {
      const who = await signIn({ ...harness, app } as Harness, { area: 'redazione' });
      const { payload, headers } = multipartOf(
        who,
        'verbale-sintetico.pdf',
        buildPdf({ withMetadata: true }),
      );
      const response = await app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(response.statusCode, response.body).toBe(201);
      const stored = harness.store.objects.get(`media-public/${response.json().storageKey}`);
      expect(stored).toBeDefined();
      expect(contains(stored ?? Buffer.alloc(0), MARKERS.author)).toBe(false);
    } finally {
      await app.close();
    }
  });
});
