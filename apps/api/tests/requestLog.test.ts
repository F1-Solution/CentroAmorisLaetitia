import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashAddress } from '../src/lib/crypto.js';
import { createHarness, fakeObjectStore, type Harness } from './_support/harness.js';

/**
 * Wave 1F-W4, T6f (DR-390): il log dell'API scrive per ogni richiesta solo metodo,
 * percorso senza query, identificativo, esito, durata e digest con sale dell'IP.
 * Mai l'indirizzo, la porta, l'host, lo user-agent o la query. Dati sintetici.
 */

const IP_SINTETICO = '203.0.113.77';
const SENTINELLA = 'parola-sentinella';
const AGENTE = 'agente-sintetico-di-prova/1.0';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness('api_request_log');
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

interface LogLine {
  readonly [key: string]: unknown;
  readonly reqId?: string;
  readonly msg?: string;
  readonly req?: { readonly method?: string; readonly path?: string; readonly ipHash?: string };
  readonly res?: { readonly statusCode?: number };
  readonly responseTime?: number;
}

async function tracedApp(lines: string[]) {
  const logStream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString('utf8'));
      done();
    },
  });
  const app = await buildApp(
    { ...harness.config, LOG_LEVEL: 'info' },
    { objectStore: fakeObjectStore(), logStream },
  );
  await app.register(async (scoped) => {
    scoped.get('/__t6f/ok', async () => ({ ok: true }));
    scoped.get('/__t6f/rifiuto', async (_request, reply) => reply.code(400).send({ no: true }));
    scoped.get('/__t6f/guasto', async () => {
      throw new Error('guasto sintetico di prova');
    });
  });
  await app.ready();
  return app;
}

const parse = (lines: readonly string[]): LogLine[] =>
  lines
    .join('')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as LogLine);

describe('log delle richieste (DR-390)', () => {
  it.each([
    ['/__t6f/ok', 200],
    ['/__t6f/rifiuto', 400],
    ['/__t6f/inesistente', 404],
    ['/__t6f/guasto', 500],
  ])('%s (%i): solo metodo, percorso, esito, durata e digest dell’IP', async (path, status) => {
    const lines: string[] = [];
    const app = await tracedApp(lines);
    try {
      const risposta = await app.inject({
        method: 'GET',
        url: `${path}?s=${SENTINELLA}#frammento`,
        headers: { 'x-forwarded-for': IP_SINTETICO, 'user-agent': AGENTE },
      });
      expect(risposta.statusCode).toBe(status);

      const grezzo = lines.join('');
      expect(grezzo).not.toContain(IP_SINTETICO);
      expect(grezzo).not.toContain(SENTINELLA);
      expect(grezzo).not.toContain('?s=');
      expect(grezzo).not.toContain(AGENTE);
      expect(grezzo).not.toMatch(/"(remoteAddress|remotePort|hostname|host|user-agent|url|query)"/);

      const righe = parse(lines);
      const ingresso = righe.find((riga) => riga.msg === 'incoming request');
      expect(ingresso?.req).toEqual({
        method: 'GET',
        path,
        ipHash: hashAddress(IP_SINTETICO, harness.config.IP_HASH_SALT)?.toString('hex'),
      });
      expect(ingresso?.req?.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(ingresso?.reqId).toEqual(expect.any(String));

      const fine = righe.find(
        (riga) => riga.msg === 'request completed' && riga.reqId === ingresso?.reqId,
      );
      expect(fine?.res).toEqual({ statusCode: status });
      expect(fine?.responseTime).toEqual(expect.any(Number));

      if (status === 500) {
        // L'errore vero porta lo stesso identificativo della richiesta, senza IP né query.
        const guasto = righe.find((riga) => riga.msg === 'richiesta fallita');
        expect(guasto?.reqId).toBe(ingresso?.reqId);
      }
    } finally {
      await app.close();
    }
  });
});
