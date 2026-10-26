import { schema } from '@amoris/db';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as VariantsModule from '../src/modules/media/variants.js';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Un errore di `sharp` durante l'elaborazione è un file illeggibile, non un guasto (M-5):
 * l'errore si inietta al posto dell'elaborazione vera.
 */

const control = vi.hoisted(() => ({ failWith: null as Error | null }));

vi.mock('../src/modules/media/variants.js', async (importOriginal) => {
  const original = await importOriginal<typeof VariantsModule>();
  return {
    ...original,
    processImage: (...args: Parameters<typeof original.processImage>) => {
      if (control.failWith) return Promise.reject(control.failWith);
      return original.processImage(...args);
    },
  };
});

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_media_process_failure');
  signed = await signIn(harness, { area: 'redazione' });
}, 180_000);

afterAll(async () => {
  control.failWith = null;
  await harness?.teardown();
});

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 40, channels: 3, background: '#2060c0' } })
    .png()
    .toBuffer();
}

function request(method: 'POST' | 'PUT', url: string, body: Buffer) {
  const boundary = '----prova-sintetica';
  const head = Buffer.from(
    `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="a.png"\r\n` +
      `content-type: image/png\r\n\r\n`,
  );
  return harness.app.inject({
    method,
    url,
    headers: {
      ...signed.writeHeaders,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([head, body, Buffer.from(`\r\n--${boundary}--\r\n`)]),
  });
}

describe('errore di sharp durante l’elaborazione (M-5)', () => {
  it('nel caricamento esce come 400 MEDIA_FILE_INVALID e non scrive nulla', async () => {
    control.failWith = new Error('vips: errore di decodifica (prova)');
    const before = harness.store.puts.length;
    try {
      const response = await request('POST', '/media', await png());
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('MEDIA_FILE_INVALID');
      expect(response.json().error.message).toContain('a.png');
    } finally {
      control.failWith = null;
    }
    expect(harness.store.puts).toHaveLength(before);
    expect(await harness.db.select().from(schema.media)).toHaveLength(0);
  });

  it('nella sostituzione esce come 400 MEDIA_FILE_INVALID', async () => {
    const created = await request('POST', '/media', await png());
    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: string };
    control.failWith = new Error('vips: errore di decodifica (prova)');
    try {
      const response = await request('PUT', `/media/${id}/file`, await png());
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('MEDIA_FILE_INVALID');
    } finally {
      control.failWith = null;
    }
  });
});
