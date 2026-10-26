import { Writable } from 'node:stream';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { mediaMultipartError } from '../src/modules/media/multipartErrors.js';
import { storeErrorFields } from '../src/modules/media/storeErrorLog.js';
import {
  createHarness,
  fakeObjectStore,
  signIn,
  testConfig,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Residui di D157 (DR-261) della 1G-W6: frequenza dei caricamenti, corpo senza parti
 * valide e chiavi dell'archivio fuori dal log. Nessun dato reale: file e chiavi sono sintetici.
 */

/** Una chiave che somiglia a un nome di persona: non deve mai arrivare al log. */
const SYNTHETIC_KEY = '2026/10/maria-rossi-referto-sintetico.png';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness('api_media_residui');
}, 180_000);

afterAll(async () => {
  await harness?.teardown();
});

const solid = (): Promise<Buffer> =>
  sharp({ create: { width: 30, height: 30, channels: 3, background: '#c82828' } })
    .png()
    .toBuffer();

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

describe('frequenza dei caricamenti (N3)', () => {
  it('oltre il tetto POST e PUT rispondono 429 MEDIA_RATE_LIMITED con messaggio in italiano', async () => {
    const limited = await createHarness('api_media_rate_it', { MEDIA_WRITES_PER_MINUTE: '1' });
    try {
      const who = await signIn(limited, { area: 'redazione' });
      const { payload, headers } = multipartOf(who, 'a.png', await solid());
      const send = (method: 'POST' | 'PUT', url: string) =>
        limited.app.inject({ method, url, headers, payload });

      const first = await send('POST', '/media');
      expect(first.statusCode).toBe(201);
      const blocked = await send('POST', '/media');
      expect(blocked.statusCode).toBe(429);
      const { error } = blocked.json();
      expect(error.code).toBe('MEDIA_RATE_LIMITED');
      expect(error.message).toMatch(/troppi caricamenti/i);
      expect(typeof error.requestId).toBe('string');
      expect(Object.keys(error).sort()).toEqual(['code', 'message', 'requestId']);

      const missing = '00000000-0000-4000-8000-000000000000';
      const putFirst = await send('PUT', `/media/${missing}/file`);
      expect(putFirst.statusCode).toBe(404);
      const putBlocked = await send('PUT', `/media/${missing}/file`);
      expect(putBlocked.statusCode).toBe(429);
      expect(putBlocked.json().error.code).toBe('MEDIA_RATE_LIMITED');
    } finally {
      await limited.teardown();
    }
  });

  it('il limite di un’altra rotta (account) resta quello di prima: 429 con il codice del plugin', async () => {
    const limited = await createHarness('api_media_rate_acc');
    try {
      const who = await signIn(limited, {
        area: 'impostazioni',
        email: 'amministrazione.sintetica@esempio.invalid',
      });
      // 30 scritture al minuto: la trentunesima richiesta è respinta dal tetto, senza il codice dei media.
      let last = 0;
      let code = '';
      for (let attempt = 0; attempt < 31 && last !== 429; attempt += 1) {
        const response = await limited.app.inject({
          method: 'POST',
          url: '/accounts',
          headers: who.writeHeaders,
          payload: {},
        });
        last = response.statusCode;
        code = (response.json() as { error?: { code?: string } }).error?.code ?? '';
      }
      expect(last).toBe(429);
      expect(code).not.toBe('MEDIA_RATE_LIMITED');
    } finally {
      await limited.teardown();
    }
  });
});

describe('corpo senza parti valide (residuo di N1)', () => {
  it('«Preamble terminated early» sulle rotte di caricamento è 400 MEDIA_UPLOAD_INVALID', () => {
    for (const message of [
      'Preamble terminated early',
      'Preamble terminated early due to unexpected end of multipart data',
    ]) {
      expect(mediaMultipartError(new Error(message) as never, harness.config, true)).toMatchObject({
        status: 400,
        code: 'MEDIA_UPLOAD_INVALID',
      });
    }
  });

  it('fuori dalle rotte di caricamento resta senza traduzione', () => {
    expect(
      mediaMultipartError(new Error('Preamble terminated early') as never, harness.config, false),
    ).toBeNull();
  });

  it('un corpo che finisce nel preambolo risponde 400 in italiano, mai 500', async () => {
    const who = await signIn(harness, { area: 'redazione' });
    const boundary = '----prova-sintetica';
    const response = await harness.app.inject({
      method: 'POST',
      url: '/media',
      headers: { ...who.writeHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: 'testo senza alcuna parte, finito nel preambolo',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('MEDIA_UPLOAD_INVALID');
  });

  it('un errore di un’altra rotta con lo stesso messaggio resta 500 e va nel log (DR-256)', async () => {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const config = testConfig(harness.config.DATABASE_URL, { LOG_LEVEL: 'error' });
    const app = await buildApp(config, { objectStore: harness.store, logStream });
    app.get('/zz-prova-preambolo', async () => {
      throw new Error('Preamble terminated early');
    });
    await app.ready();
    try {
      const response = await app.inject({ method: 'GET', url: '/zz-prova-preambolo' });
      expect(response.statusCode).toBe(500);
      expect(response.json().error.code).toBe('INTERNAL_ERROR');
    } finally {
      await app.close();
    }
    expect(lines.some((line) => line.includes('richiesta fallita'))).toBe(true);
  });
});

describe('log degli errori dell’archivio senza chiave (N6)', () => {
  it('storeErrorFields tiene nome, codice e stato, mai messaggio né chiave', () => {
    const caught = Object.assign(new Error(`Access Denied: ${SYNTHETIC_KEY}`), {
      name: 'AccessDenied',
      Code: 'AccessDenied',
      Key: SYNTHETIC_KEY,
      $metadata: { httpStatusCode: 403 },
    });
    const fields = storeErrorFields(caught);
    expect(fields).toEqual({ name: 'AccessDenied', code: 'AccessDenied', httpStatus: 403 });
    expect(JSON.stringify(fields)).not.toContain('maria-rossi');
    expect(storeErrorFields('testo grezzo con maria-rossi')).toEqual({ name: 'NonError' });
  });

  /** Un archivio che, a richiesta, fallisce con un errore dell'SDK che cita la chiave. */
  function leakyStore() {
    const base = fakeObjectStore();
    const state = { failPut: false, failRemove: false };
    const sdkError = (operation: string) =>
      Object.assign(new Error(`${operation} fallita per «${SYNTHETIC_KEY}»`), {
        name: 'ServiceUnavailable',
        Code: 'SlowDown',
        $metadata: { httpStatusCode: 503 },
      });
    return {
      state,
      store: {
        ...base,
        async put(...args: Parameters<typeof base.put>) {
          if (state.failPut) throw sdkError('scrittura');
          return base.put(...args);
        },
        async remove(...args: Parameters<typeof base.remove>) {
          if (state.failRemove) throw sdkError('rimozione');
          return base.remove(...args);
        },
      },
    };
  }

  async function appWithLog() {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const { state, store } = leakyStore();
    const config = testConfig(harness.config.DATABASE_URL, { LOG_LEVEL: 'error' });
    const app = await buildApp(config, { objectStore: store, logStream });
    await app.ready();
    const who = await signIn({ ...harness, app } as Harness, { area: 'redazione' });
    return { app, who, state, lines };
  }

  it('un caricamento che fallisce sull’archivio non porta la chiave nel log', async () => {
    const { app, who, state, lines } = await appWithLog();
    try {
      state.failPut = true;
      const { payload, headers } = multipartOf(who, 'a.png', await solid());
      const response = await app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('maria-rossi');
    } finally {
      await app.close();
    }
    const text = lines.join('');
    expect(text).toContain('richiesta fallita');
    expect(text).not.toContain('maria-rossi');
    expect(text).toContain('SlowDown');
  });

  it('la pulizia dopo un’eliminazione non porta la chiave nel log', async () => {
    const { app, who, state, lines } = await appWithLog();
    try {
      const { payload, headers } = multipartOf(who, 'da-eliminare.png', await solid());
      const created = await app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(created.statusCode).toBe(201);
      state.failRemove = true;
      const removed = await app.inject({
        method: 'DELETE',
        url: `/media/${(created.json() as { id: string }).id}`,
        headers: who.writeHeaders,
      });
      expect(removed.statusCode).toBe(204);
    } finally {
      await app.close();
    }
    const text = lines.join('');
    expect(text).toContain('oggetto non rimosso');
    expect(text).not.toContain('maria-rossi');
    expect(text).not.toContain('rimozione fallita');
  });

  it('una sostituzione che fallisce sull’archivio non porta la chiave nel log', async () => {
    const { app, who, state, lines } = await appWithLog();
    try {
      const { payload, headers } = multipartOf(who, 'da-sostituire.png', await solid());
      const created = await app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(created.statusCode).toBe(201);
      state.failPut = true;
      const replaced = await app.inject({
        method: 'PUT',
        url: `/media/${(created.json() as { id: string }).id}/file`,
        headers,
        payload,
      });
      expect(replaced.statusCode).toBe(500);
    } finally {
      await app.close();
    }
    const text = lines.join('');
    expect(text).toContain('sostituzione del file non completata');
    expect(text).not.toContain('maria-rossi');
  });
});
