import { schema } from '@amoris/db';
import { sql } from 'drizzle-orm';
import { createServer, type Server } from 'node:http';
import { Writable } from 'node:stream';
import type { AddressInfo, Socket } from 'node:net';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createObjectStore } from '../src/lib/objectStore.js';
import { folderOfKey, planFiles, removeQuietly } from '../src/modules/media/derivatives.js';
import { mediaMultipartError } from '../src/modules/media/multipartErrors.js';
import { assertSameFormat, detectMime } from '../src/modules/media/fileType.js';
import { createGate } from '../src/modules/media/gate.js';
import { folderFor } from '../src/modules/media/service.js';
import {
  createHarness,
  signIn,
  testConfig,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Giro finale della wave 1G-W5: robustezza dell'elaborazione, dei blocchi e degli errori
 * del modulo `media`. Nessun dato reale: le immagini si generano qui.
 */

const MIB = 1024 * 1024;

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_media_hardening');
  signed = await signIn(harness, { area: 'redazione' });
}, 180_000);

afterAll(async () => {
  await harness?.teardown();
});

function multipartOf(who: Signed, fileName: string, body: Buffer, tail = true) {
  const boundary = '----prova-sintetica';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `content-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `content-type: application/octet-stream\r\n\r\n`,
  );
  const end = tail ? Buffer.from(`\r\n--${boundary}--\r\n`) : Buffer.alloc(0);
  return {
    payload: Buffer.concat([head, body, end]),
    headers: { ...who.writeHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

function post(h: Harness, who: Signed, fileName: string, body: Buffer, tail = true) {
  const { payload, headers } = multipartOf(who, fileName, body, tail);
  return h.app.inject({ method: 'POST', url: '/media', headers, payload });
}

const solid = (format: 'png' | 'jpeg' | 'webp', size = 30): Promise<Buffer> =>
  sharp({ create: { width: size, height: size, channels: 3, background: '#c82828' } })
    [format]()
    .toBuffer();

async function until(condition: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`attesa scaduta: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Vero se il blocco della cartella è libero, cioè nessuno lo tiene. */
async function folderLockIsFree(h: Harness, folder: string): Promise<boolean> {
  return h.db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`select pg_try_advisory_xact_lock(hashtext(${`media.folder:${folder}`}::text)) as ok`,
    );
    return (rows as unknown as { ok: boolean }[])[0]?.ok === true;
  });
}

function mp4Header(size: number, major = 'isom'): Buffer {
  const head = Buffer.alloc(16);
  head.writeUInt32BE(size, 0);
  head.write('ftyp', 4, 'latin1');
  head.write(major, 8, 'latin1');
  return head;
}

describe('firma ftyp dell’MP4 (MEDIUM-1)', () => {
  it('con dimensione 0xFFFFFFFF su 100 MB non si blocca e non è un MP4', () => {
    const body = Buffer.concat([mp4Header(0xffffffff, 'abcd'), Buffer.alloc(100 * MIB)]);
    const started = performance.now();
    expect(detectMime(body)).toBeNull();
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('con dimensione 0 il blocco non è valido, anche con una marca nota', () => {
    expect(detectMime(Buffer.concat([mp4Header(0, 'isom'), Buffer.alloc(64)]))).toBeNull();
    expect(detectMime(Buffer.concat([mp4Header(0xffffffff, 'isom'), Buffer.alloc(64)]))).toBeNull();
  });

  it('con dimensione oltre 4096 il blocco non è valido', () => {
    expect(detectMime(Buffer.concat([mp4Header(4097, 'isom'), Buffer.alloc(5000)]))).toBeNull();
  });

  it('una marca compatibile dentro la finestra dichiarata riconosce l’MP4', () => {
    const body = Buffer.concat([mp4Header(24, 'abcd'), Buffer.from('xxxxmp42'), Buffer.alloc(32)]);
    expect(detectMime(body)).toBe('video/mp4');
  });
});

describe('lettori di sharp (HIGH-1)', () => {
  it('SVG, GIF e TIFF non si leggono più', async () => {
    const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } })
      .gif()
      .toBuffer();
    const tiff = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } })
      .tiff()
      .toBuffer();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>');
    for (const body of [gif, tiff, svg]) {
      await expect(sharp(body).metadata()).rejects.toThrow();
    }
  });

  it('JPEG, PNG e WebP si leggono ancora', async () => {
    for (const format of ['jpeg', 'png', 'webp'] as const) {
      expect((await sharp(await solid(format)).metadata()).width).toBe(30);
    }
  });

  it('il formato letto da sharp deve coincidere con il tipo dalle firme', () => {
    expect(() => assertSameFormat('a.png', 'image/png', 'png')).not.toThrow();
    expect(() => assertSameFormat('a.jpg', 'image/jpeg', 'jpeg')).not.toThrow();
    expect(() => assertSameFormat('a.webp', 'image/webp', 'webp')).not.toThrow();
    expect(() => assertSameFormat('a.png', 'image/png', 'gif')).toThrowError(
      expect.objectContaining({ code: 'MEDIA_FILE_INVALID', statusCode: 400 }),
    );
    expect(() => assertSameFormat('a.jpg', 'image/jpeg', 'png')).toThrowError(
      expect.objectContaining({ code: 'MEDIA_FILE_INVALID' }),
    );
  });
});

describe('semaforo dell’elaborazione (MEDIUM-2)', () => {
  it('al massimo N insieme, una coda corta, poi MEDIA_BUSY', async () => {
    const gate = createGate(1, 1);
    const events: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const first = gate.run(
      () =>
        new Promise<string>((resolve) => {
          events.push('primo');
          releaseFirst = () => resolve('a');
        }),
    );
    const second = gate.run(async () => {
      events.push('secondo');
      return 'b';
    });
    await expect(gate.run(async () => 'c')).rejects.toMatchObject({
      code: 'MEDIA_BUSY',
      statusCode: 503,
    });
    expect(events).toEqual(['primo']);
    releaseFirst();
    expect(await first).toBe('a');
    expect(await second).toBe('b');
    expect(events).toEqual(['primo', 'secondo']);
    expect(await gate.run(async () => 'd')).toBe('d');
  });

  it('con il semaforo pieno e la coda a zero il caricamento risponde 503 in italiano', async () => {
    const busy = await createHarness('api_media_busy', {
      MEDIA_MAX_CONCURRENT: '1',
      MEDIA_QUEUE_LENGTH: '0',
    });
    try {
      const who = await signIn(busy, { area: 'redazione' });
      let release: () => void = () => undefined;
      const holding = busy.app.mediaRuntime.gate.run(
        () => new Promise<void>((resolve) => (release = resolve)),
      );
      const response = await post(busy, who, 'a.png', await solid('png'));
      expect(response.statusCode).toBe(503);
      const { error } = response.json();
      expect(error.code).toBe('MEDIA_BUSY');
      expect(error.message).toMatch(/riprova/i);
      expect(busy.store.puts).toHaveLength(0);
      release();
      await holding;
      expect((await post(busy, who, 'a.png', await solid('png'))).statusCode).toBe(201);
    } finally {
      await busy.teardown();
    }
  });
});

describe('limite di frequenza delle scritture (MEDIUM-2)', () => {
  it('POST /media e PUT /media/:id/file rispondono 429 oltre il tetto', async () => {
    const limited = await createHarness('api_media_rate', { MEDIA_WRITES_PER_MINUTE: '2' });
    try {
      const who = await signIn(limited, { area: 'redazione' });
      const png = await solid('png');
      const codes: number[] = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        codes.push((await post(limited, who, `a${attempt}.png`, png)).statusCode);
      }
      expect(codes).toEqual([201, 201, 429]);

      const { payload, headers } = multipartOf(who, 'x.png', png);
      const put = (id: string) =>
        limited.app.inject({ method: 'PUT', url: `/media/${id}/file`, headers, payload });
      const missing = '00000000-0000-4000-8000-000000000000';
      const puts = [await put(missing), await put(missing), await put(missing)];
      expect(puts.map((response) => response.statusCode)).toEqual([404, 404, 429]);
    } finally {
      await limited.teardown();
    }
  });
});

describe('compensazione e cancellazione sotto il blocco (LOW-1)', () => {
  it('dopo un errore di scrittura gli oggetti si tolgono mentre il blocco della cartella è tenuto', async () => {
    const image = await sharp({
      create: { width: 1500, height: 1000, channels: 3, background: '#2840c8' },
    })
      .jpeg()
      .toBuffer();
    const originalPut = harness.store.put;
    const originalRemove = harness.store.remove;
    let calls = 0;
    let removing = false;
    let open: () => void = () => undefined;
    const gateOpen = new Promise<void>((resolve) => (open = resolve));
    harness.store.put = async (...args) => {
      calls += 1;
      if (calls === 3) throw new Error('rete interrotta (prova)');
      return originalPut(...args);
    };
    harness.store.remove = async (...args) => {
      removing = true;
      await gateOpen;
      return originalRemove(...args);
    };
    try {
      const pending = post(harness, signed, 'compensata.jpg', image);
      await until(() => removing, 'rimozione degli oggetti');
      expect(await folderLockIsFree(harness, folderFor(new Date()))).toBe(false);
      open();
      expect((await pending).statusCode).toBe(500);
    } finally {
      harness.store.put = originalPut;
      harness.store.remove = originalRemove;
      open();
    }
  });

  it('eliminare un media toglie gli oggetti sotto i blocchi, dopo aver tolto le righe', async () => {
    const created = await post(harness, signed, 'da-eliminare.png', await solid('png', 400));
    expect(created.statusCode).toBe(201);
    const { id, storageKey } = created.json() as { id: string; storageKey: string };

    const originalRemove = harness.store.remove;
    let removing = false;
    let open: () => void = () => undefined;
    const gateOpen = new Promise<void>((resolve) => (open = resolve));
    harness.store.remove = async (...args) => {
      removing = true;
      await gateOpen;
      return originalRemove(...args);
    };
    try {
      const pending = harness.app.inject({
        method: 'DELETE',
        url: `/media/${id}`,
        headers: signed.writeHeaders,
      });
      await until(() => removing, 'rimozione degli oggetti');
      expect(await folderLockIsFree(harness, folderOfKey(storageKey))).toBe(false);
      const rows = await harness.db.select().from(schema.media);
      expect(rows.some((row) => row.id === id)).toBe(false);
      open();
      expect((await pending).statusCode).toBe(204);
    } finally {
      harness.store.remove = originalRemove;
      open();
    }
    expect(harness.store.objects.has(`media-public/${storageKey}`)).toBe(false);
  });
});

describe('attese limitate (LOW-2)', () => {
  it('il blocco della cartella tenuto da altri oltre il tempo massimo dà 503 MEDIA_BUSY', async () => {
    const patient = await createHarness('api_media_locktimeout', {
      MEDIA_LOCK_TIMEOUT_MS: '300',
    });
    let release: () => void = () => undefined;
    let held = false;
    const holder = patient.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`media.folder:${folderFor(new Date())}`}::text))`,
      );
      held = true;
      await new Promise<void>((resolve) => (release = resolve));
    });
    try {
      const who = await signIn(patient, { area: 'redazione' });
      await until(() => held, 'blocco esterno');
      const response = await post(patient, who, 'a.png', await solid('png'));
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('MEDIA_BUSY');
      expect(patient.store.puts).toHaveLength(0);
    } finally {
      release();
      await holder;
      await patient.teardown();
    }
  });

  it('il client dell’archivio smette di aspettare un server che non risponde', async () => {
    const sockets = new Set<Socket>();
    const server: Server = createServer(() => undefined);
    server.on('connection', (socket) => sockets.add(socket));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const config = testConfig('postgres://x/y', {
        S3_ENDPOINT: `http://127.0.0.1:${port}`,
        S3_ACCESS_KEY: 'chiave-sintetica',
        S3_SECRET_KEY: 'segreto-sintetico',
        S3_REQUEST_TIMEOUT_MS: '200',
        S3_CONNECT_TIMEOUT_MS: '200',
      });
      const store = createObjectStore(config);
      const started = Date.now();
      await expect(store.put('b', 'k', Buffer.from('x'), 'text/plain')).rejects.toThrow();
      expect(Date.now() - started).toBeLessThan(8000);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  }, 20_000);
});

describe('log di compensazione senza nomi di file (LOW-3)', () => {
  it('registra solo numero e impronta delle chiavi, mai la chiave', async () => {
    const logged: { context: Record<string, unknown>; message: string }[] = [];
    const failing = {
      ...harness.store,
      remove: async () => {
        throw new Error('archivio non raggiungibile (prova)');
      },
    };
    await removeQuietly(
      failing,
      'media-public',
      ['2026/10/maria-rossi-referto.pdf', '2026/10/altro.pdf'],
      { error: (context, message) => logged.push({ context: context as never, message }) },
      { mediaId: 'id-sintetico' },
    );
    const text = JSON.stringify(logged);
    expect(text).not.toContain('maria-rossi');
    expect(text).not.toContain('altro.pdf');
    expect(text).toContain('id-sintetico');
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.every((entry) => typeof entry.context['keyDigest'] === 'string')).toBe(true);
  });
});

describe('errori di @fastify/multipart (LOW-7, M-4)', () => {
  it('un corpo troncato risponde 400 MEDIA_UPLOAD_INVALID in italiano, mai 500', async () => {
    const response = await post(harness, signed, 'a.png', await solid('png'), false);
    expect(response.statusCode).toBe(400);
    const { error } = response.json();
    expect(error.code).toBe('MEDIA_UPLOAD_INVALID');
    expect(error.message).toMatch(/[a-zà-ù]{3,}/);
  });

  it('i limiti di file, parti e campi rispondono 413 MEDIA_TOO_MANY_PARTS', () => {
    for (const code of ['FST_FILES_LIMIT', 'FST_PARTS_LIMIT', 'FST_FIELDS_LIMIT']) {
      const caught = Object.assign(new Error('limit'), { code, statusCode: 413 });
      const translated = mediaMultipartError(caught as never, harness.config, true);
      expect(translated).toMatchObject({ status: 413, code: 'MEDIA_TOO_MANY_PARTS' });
      expect(translated?.message).toMatch(/un file alla volta/i);
    }
  });

  it('due file nella stessa richiesta non danno mai un 500', async () => {
    const boundary = '----prova-sintetica';
    const part = (name: string) =>
      `--${boundary}
content-disposition: form-data; name="file"; filename="${name}"
` +
      `content-type: application/octet-stream

xx
`;
    const response = await harness.app.inject({
      method: 'POST',
      url: '/media',
      headers: {
        ...signed.writeHeaders,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: `${part('a.png')}${part('b.png')}--${boundary}--
`,
    });
    expect(response.statusCode).toBeLessThan(500);
    expect(response.json().error.message).toMatch(/[a-zà-ù]{3,}/);
  });

  it('oltre il massimo il 413 dice il limite del tipo dall’estensione del nome', async () => {
    const small = await createHarness('api_media_413', {
      MEDIA_MAX_IMAGE_BYTES: String(2 * MIB),
      MEDIA_MAX_PDF_BYTES: String(1 * MIB),
      MEDIA_MAX_VIDEO_BYTES: String(3 * MIB),
    });
    try {
      const who = await signIn(small, { area: 'redazione' });
      const huge = Buffer.alloc(4 * MIB);
      const image = await post(small, who, 'enorme.jpg', huge);
      expect(image.statusCode).toBe(413);
      expect(image.json().error.message).toContain('2 MB');
      expect(image.json().error.message).toContain('JPEG');
      const unknown = await post(small, who, 'enorme.xyz', huge);
      expect(unknown.statusCode).toBe(413);
      expect(unknown.json().error.message).toContain('3 MB');
    } finally {
      await small.teardown();
    }
  });
});

describe('la traduzione multipart non tocca le altre rotte (N1)', () => {
  const messages = [
    'params: Nascite premature del gruppo',
    'Premature close',
    'Unexpected end of JSON input',
  ];

  it('fuori dalle rotte di caricamento nessun errore si traduce', () => {
    for (const message of messages) {
      const caught = new Error(message);
      expect(mediaMultipartError(caught as never, harness.config, false)).toBeNull();
    }
  });

  it('sulle rotte di caricamento solo i messaggi esatti di busboy si traducono', () => {
    for (const message of [
      'params: Nascite premature del gruppo',
      'Unexpected end of JSON input',
    ]) {
      expect(mediaMultipartError(new Error(message) as never, harness.config, true)).toBeNull();
    }
    expect(
      mediaMultipartError(new Error('Premature close') as never, harness.config, true),
    ).toMatchObject({ code: 'MEDIA_UPLOAD_INVALID', status: 400 });
  });

  it('un errore senza stato di un’altra rotta resta 500 INTERNAL_ERROR e va nel log', async () => {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const config = testConfig(harness.config.DATABASE_URL, { LOG_LEVEL: 'error' });
    const app = await buildApp(config, { objectStore: harness.store, logStream });
    messages.forEach((message, index) => {
      app.get(`/zz-prova-errore-${index}`, async () => {
        throw new Error(message);
      });
    });
    await app.ready();
    try {
      for (let index = 0; index < messages.length; index += 1) {
        const response = await app.inject({ method: 'GET', url: `/zz-prova-errore-${index}` });
        expect(response.statusCode).toBe(500);
        expect(response.json().error.code).toBe('INTERNAL_ERROR');
      }
    } finally {
      await app.close();
    }
    expect(lines.filter((line) => line.includes('richiesta fallita'))).toHaveLength(
      messages.length,
    );
  });
});

describe('chiavi senza cartella (M-3)', () => {
  it('folderOfKey dà la cartella vuota se manca la barra', () => {
    expect(folderOfKey('2026/10/a.jpg')).toBe('2026/10');
    expect(folderOfKey('a.jpg')).toBe('');
  });

  it('planFiles non mette una barra iniziale senza cartella', () => {
    const [one] = planFiles([{ body: Buffer.alloc(1), width: 150, height: 150 }], '', 'a', 'jpg');
    expect(one?.storageKey).toBe('a-150x150.jpg');
    expect(one?.publicPath).toBe('/media/a-150x150.jpg');
  });
});

describe('colore del PNG a tavolozza e WebP senza perdita (I-1)', () => {
  /** Strisce di 8 colori con una diagonale: tipico PNG a tavolozza di una grafica. */
  async function paletteImage(): Promise<Buffer> {
    const width = 1600;
    const height = 1000;
    const raw = Buffer.alloc(width * height * 3);
    const colors = [0, 36, 72, 108, 144, 180, 216, 252];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const level = colors[(Math.floor(x / 40) + Math.floor(y / 25)) % colors.length] ?? 0;
        const at = (y * width + x) * 3;
        raw[at] = level;
        raw[at + 1] = 255 - level;
        raw[at + 2] = (x + y) % 64 < 32 ? 40 : 200;
      }
    }
    return sharp(raw, { raw: { width, height, channels: 3 } })
      .png({ palette: true, colours: 16 })
      .toBuffer();
  }

  it('un PNG a tavolozza resta a tavolozza e non cresce oltre il file d’ingresso più un margine', async () => {
    const input = await paletteImage();
    expect((await sharp(input).metadata()).isPalette).toBe(true);
    const response = await post(harness, signed, 'tavolozza.png', input);
    expect(response.statusCode).toBe(201);
    const { storageKey } = response.json() as { storageKey: string };
    const stored = harness.store.objects.get(`media-public/${storageKey}`);
    expect(stored).toBeDefined();
    expect((await sharp(stored).metadata()).isPalette).toBe(true);
    expect(stored?.byteLength ?? Infinity).toBeLessThanOrEqual(input.byteLength * 1.3 + 2048);
  });

  it('un WebP senza perdita si riscrive senza perdita', async () => {
    const input = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#10a050' },
    })
      .webp({ lossless: true })
      .toBuffer();
    expect(input.subarray(12, 16).toString('latin1')).toBe('VP8L');
    const response = await post(harness, signed, 'senza-perdita.webp', input);
    expect(response.statusCode).toBe(201);
    const { storageKey } = response.json() as { storageKey: string };
    const stored = harness.store.objects.get(`media-public/${storageKey}`);
    expect(stored?.subarray(12, 16).toString('latin1')).toBe('VP8L');
  });

  it('un WebP con perdita resta con perdita', async () => {
    const response = await post(harness, signed, 'con-perdita.webp', await solid('webp'));
    const { storageKey } = response.json() as { storageKey: string };
    const stored = harness.store.objects.get(`media-public/${storageKey}`);
    expect(stored?.subarray(12, 16).toString('latin1')).toBe('VP8 ');
  });
});
