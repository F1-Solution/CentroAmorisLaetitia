import { createServer } from 'node:net';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ConfigError } from '../src/config.js';
import {
  createHarness,
  signIn,
  testConfig,
  type Harness,
  type Signed,
} from './_support/harness.js';
import { assertToolsInstalled, buildPdf } from './_support/syntheticFiles.js';

/**
 * Servizio di pulizia configurato ma spento (1F-W2 T5, DR-359, DR-363).
 *
 * L'API configurata per il servizio non ripiega mai sui programmi locali: anche con `qpdf`
 * installato e raggiungibile, se il servizio non risponde il PDF si rifiuta con il messaggio
 * di oggi e nulla si scrive; le immagini, che non passano dalla pulizia, si caricano.
 * Solo file sintetici.
 */

const TOKEN = 'gettone-sintetico-del-servizio-di-pulizia-1f';
const MESSAGE =
  'Il caricamento di PDF e video è sospeso: il servizio non riesce a ripulire i file. Avvisa chi gestisce il sito.';

/** Una porta libera su cui nessuno ascolta: il servizio «spento». */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

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

let harness: Harness;

beforeAll(async () => {
  await assertToolsInstalled();
  harness = await createHarness('api_scrub_off');
}, 180_000);

afterAll(async () => {
  await harness?.teardown();
});

describe('servizio di pulizia configurato ma spento (DR-363)', () => {
  async function appOff() {
    const port = await closedPort();
    const config = testConfig(harness.config.DATABASE_URL, {
      SCRUB_SERVICE_URL: `http://127.0.0.1:${port}`,
      SCRUB_SERVICE_TOKEN: TOKEN,
    });
    const app = await buildApp(config, { objectStore: harness.store });
    await app.ready();
    const who = await signIn({ ...harness, app } as Harness, { area: 'redazione' });
    return { app, who };
  }

  it('un PDF si rifiuta con il messaggio di oggi, senza ripiegare su qpdf locale', async () => {
    const { app, who } = await appOff();
    try {
      const putsBefore = harness.store.puts.length;
      const { payload, headers } = multipartOf(who, 'verbale-sintetico.pdf', buildPdf());
      const response = await app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('MEDIA_SCRUB_UNAVAILABLE');
      expect(response.json().error.message).toBe(MESSAGE);
      expect(harness.store.puts.length).toBe(putsBefore);
    } finally {
      await app.close();
    }
  });

  it("un'immagine si carica", async () => {
    const { app, who } = await appOff();
    try {
      const png = await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#808080' },
      })
        .png()
        .toBuffer();
      const { payload, headers } = multipartOf(who, 'quadrato-sintetico.png', png);
      const response = await app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(response.statusCode, response.body).toBe(201);
    } finally {
      await app.close();
    }
  });
});

describe('configurazione del servizio di pulizia', () => {
  const base = {
    DATABASE_URL: 'postgres://sintetico@127.0.0.1:5432/sintetico',
    IP_HASH_SALT: 'sale-sintetico-per-i-test-abbastanza-lungo',
    CSRF_SECRET: 'segreto-sintetico-per-i-test-abbastanza-lungo',
  };

  it("l'indirizzo senza gettone non parte", async () => {
    const { loadConfig } = await import('../src/config.js');
    expect(() => loadConfig({ ...base, SCRUB_SERVICE_URL: 'http://scrub:3003' })).toThrow(
      ConfigError,
    );
  });

  it('indirizzo e gettone vuoti valgono come assenti: pulizia con i programmi locali', async () => {
    const { loadConfig, scrubToolsOf } = await import('../src/config.js');
    const config = loadConfig({ ...base, SCRUB_SERVICE_URL: '', SCRUB_SERVICE_TOKEN: '' });
    expect(scrubToolsOf(config).service).toBeUndefined();
  });

  it('un gettone troppo corto non parte', async () => {
    const { loadConfig } = await import('../src/config.js');
    expect(() =>
      loadConfig({ ...base, SCRUB_SERVICE_URL: 'http://scrub:3003', SCRUB_SERVICE_TOKEN: 'corto' }),
    ).toThrow(ConfigError);
  });

  it('un indirizzo che non è http non parte', async () => {
    const { loadConfig } = await import('../src/config.js');
    expect(() =>
      loadConfig({ ...base, SCRUB_SERVICE_URL: 'file:///tmp/x', SCRUB_SERVICE_TOKEN: TOKEN }),
    ).toThrow(ConfigError);
  });
});
