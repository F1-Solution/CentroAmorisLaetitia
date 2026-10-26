import { schema } from '@amoris/db';
import { count } from 'drizzle-orm';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sanitizeFileName } from '../src/modules/media/fileName.js';
import { detectMime } from '../src/modules/media/fileType.js';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Tipi di file e limiti dei media (1G-14, D147-A): ogni rifiuto ha un codice
 * stabile, un messaggio in italiano e non scrive né nell'archivio né a database.
 *
 * Nessun dato reale: le immagini si generano qui, di pochi byte.
 */

const MIB = 1024 * 1024;

let harness: Harness;
let signed: Signed;
let small: Harness;
let smallSigned: Signed;

let png: Buffer;
let jpeg: Buffer;
let webp: Buffer;

const PDF = Buffer.from('%PDF-1.4\n% documento sintetico\n%%EOF\n');
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from('ftypisom'),
  Buffer.from([0, 0, 2, 0]),
  Buffer.from('isomiso2'),
]);

async function synthetic(format: 'png' | 'jpeg' | 'webp', size = 20): Promise<Buffer> {
  const base = sharp({
    create: { width: size, height: size, channels: 3, background: { r: 200, g: 40, b: 40 } },
  });
  return base[format]().toBuffer();
}

/** PNG con un'intestazione che dichiara 10000 x 10000 pixel e nient'altro di valido. */
function pngDeclaringHugeSize(): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(head));
    return Buffer.concat([length, head, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(10_000, 0);
  header.writeUInt32BE(10_000, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

beforeAll(async () => {
  [png, jpeg, webp] = await Promise.all([synthetic('png'), synthetic('jpeg'), synthetic('webp')]);
  harness = await createHarness('api_media_upload');
  signed = await signIn(harness, { area: 'redazione' });
  small = await createHarness('api_media_limits', {
    MEDIA_MAX_IMAGE_BYTES: String(2 * MIB),
    MEDIA_MAX_PDF_BYTES: String(1 * MIB),
    MEDIA_MAX_VIDEO_BYTES: String(3 * MIB),
    MEDIA_MAX_IMAGE_PIXELS: '100',
  });
  smallSigned = await signIn(small, { area: 'redazione' });
}, 180_000);

afterAll(async () => {
  await harness?.teardown();
  await small?.teardown();
});

function multipart(who: Signed, fileName: string, mimeType: string, body: Buffer) {
  const boundary = '----prova-sintetica';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `content-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `content-type: ${mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, body, tail]),
    headers: { ...who.writeHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

async function post(h: Harness, who: Signed, fileName: string, mimeType: string, body: Buffer) {
  const { payload, headers } = multipart(who, fileName, mimeType, body);
  return h.app.inject({ method: 'POST', url: '/media', headers, payload });
}

async function mediaRows(h: Harness): Promise<number> {
  const [row] = await h.db.select({ value: count() }).from(schema.media);
  return row?.value ?? 0;
}

async function snapshotOf(h: Harness) {
  return { puts: h.store.puts.length, rows: await mediaRows(h) };
}

/** Un rifiuto non lascia traccia: né oggetti nell'archivio, né righe. */
async function expectRejection(
  h: Harness,
  response: { statusCode: number; json(): { error: { code: string; message: string } } },
  status: number,
  code: string,
  before: { puts: number; rows: number },
) {
  expect(response.statusCode).toBe(status);
  const { error } = response.json();
  expect(error.code).toBe(code);
  expect(error.message).toMatch(/[a-zà-ù]{3,}/);
  expect(error.message).not.toMatch(/request file too large|the request is not multipart/);
  expect(h.store.puts.length).toBe(before.puts);
  expect(await mediaRows(h)).toBe(before.rows);
}

describe('riconoscimento del tipo dal contenuto (S3)', () => {
  it('riconosce JPEG, PNG, WebP, PDF e MP4 dalle firme', () => {
    expect(detectMime(jpeg)).toBe('image/jpeg');
    expect(detectMime(png)).toBe('image/png');
    expect(detectMime(webp)).toBe('image/webp');
    expect(detectMime(PDF)).toBe('application/pdf');
    expect(detectMime(MP4)).toBe('video/mp4');
  });

  it('non riconosce HTML, SVG, testo e file vuoti', () => {
    expect(detectMime(Buffer.from('<!doctype html><html></html>'))).toBeNull();
    expect(detectMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectMime(Buffer.from('ciao'))).toBeNull();
    expect(detectMime(Buffer.alloc(0))).toBeNull();
  });
});

describe('pulizia del nome (S6)', () => {
  it('toglie cartelle e punti doppi', () => {
    expect(sanitizeFileName('../../x.jpg')).toBe('x.jpg');
    expect(sanitizeFileName('C:\\cartella\\y.png')).toBe('y.png');
    expect(sanitizeFileName('a..b.png')).toBe('a.b.png');
  });

  it('trasforma spazi in trattini, toglie gli accenti e i caratteri non ammessi', () => {
    expect(sanitizeFileName('Foto Più Bella (1).JPG')).toBe('Foto-Piu-Bella-1.jpg');
    expect(sanitizeFileName('a&b?c#d.png')).toBe('abcd.png');
  });

  it('non lascia un nome vuoto', () => {
    expect(sanitizeFileName('.jpg')).toBe('file.jpg');
    expect(sanitizeFileName('???.png')).toBe('file.png');
  });
});

describe('rifiuti del caricamento (S5)', () => {
  it('415 MEDIA_TYPE_NOT_ALLOWED: un HTML chiamato .jpg, anche se il browser dice image/jpeg', async () => {
    const before = await snapshotOf(harness);
    const response = await post(
      harness,
      signed,
      'pagina.jpg',
      'image/jpeg',
      Buffer.from('<!doctype html><script>alert(1)</script>'),
    );
    await expectRejection(harness, response, 415, 'MEDIA_TYPE_NOT_ALLOWED', before);
    expect(response.json().error.message).toContain('JPEG, PNG, WebP, PDF e MP4');
  });

  it('415: un SVG non si ammette mai', async () => {
    const before = await snapshotOf(harness);
    const response = await post(
      harness,
      signed,
      'logo.svg',
      'image/svg+xml',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
    );
    await expectRejection(harness, response, 415, 'MEDIA_TYPE_NOT_ALLOWED', before);
  });

  it('400 MEDIA_NAME_MISMATCH: un JPEG chiamato .png, e il tipo dichiarato non conta', async () => {
    const before = await snapshotOf(harness);
    const response = await post(harness, signed, 'foto.png', 'image/png', jpeg);
    await expectRejection(harness, response, 400, 'MEDIA_NAME_MISMATCH', before);
    expect(response.json().error.message).toContain('.jpg');
  });

  it('un PNG dichiarato JPEG si riconosce PNG, e con il nome .jpg è rifiutato', async () => {
    const before = await snapshotOf(harness);
    const refused = await post(harness, signed, 'finto.jpg', 'image/jpeg', png);
    await expectRejection(harness, refused, 400, 'MEDIA_NAME_MISMATCH', before);

    const accepted = await post(harness, signed, 'vero.png', 'image/jpeg', png);
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json().mimeType).toBe('image/png');
  });

  it('un nome senza estensione si rifiuta come non corrispondente', async () => {
    const before = await snapshotOf(harness);
    const response = await post(harness, signed, 'senza-estensione', 'image/png', png);
    await expectRejection(harness, response, 400, 'MEDIA_NAME_MISMATCH', before);
  });

  it('400 MEDIA_FILE_INVALID: un PNG e un JPEG troncati', async () => {
    const before = await snapshotOf(harness);
    const noise = Buffer.alloc(300 * 300 * 3);
    for (let i = 0; i < noise.length; i += 1) noise[i] = (i * 7919) % 251;
    const raw = { raw: { width: 300, height: 300, channels: 3 as const } };
    const bigPng = await sharp(noise, raw).png().toBuffer();
    const bigJpeg = await sharp(noise, raw).jpeg().toBuffer();
    for (const [name, body] of [
      ['rotto.png', bigPng.subarray(0, Math.floor(bigPng.length / 2))],
      ['rotto.jpg', bigJpeg.subarray(0, Math.floor(bigJpeg.length / 2))],
    ] as const) {
      const response = await post(harness, signed, name, 'application/octet-stream', body);
      await expectRejection(harness, response, 400, 'MEDIA_FILE_INVALID', before);
    }
  });

  it('413 MEDIA_TOO_MANY_PIXELS: si legge l’intestazione e non si decodifica', async () => {
    const before = await snapshotOf(harness);
    const response = await post(harness, signed, 'enorme.png', 'image/png', pngDeclaringHugeSize());
    await expectRejection(harness, response, 413, 'MEDIA_TOO_MANY_PIXELS', before);
    expect(response.json().error.message).toContain('50 milioni');
  });

  it('413 MEDIA_TOO_MANY_PIXELS con il limite abbassato dalla configurazione', async () => {
    const before = await snapshotOf(small);
    const response = await post(small, smallSigned, 'grande.png', 'image/png', png);
    await expectRejection(small, response, 413, 'MEDIA_TOO_MANY_PIXELS', before);
  });

  it('413 MEDIA_TOO_LARGE: il limite del tipo, in MB nel messaggio', async () => {
    const before = await snapshotOf(small);
    const pdf = Buffer.concat([PDF, Buffer.alloc(Math.floor(1.5 * MIB))]);
    const response = await post(small, smallSigned, 'lungo.pdf', 'application/pdf', pdf);
    await expectRejection(small, response, 413, 'MEDIA_TOO_LARGE', before);
    expect(response.json().error.message).toContain('1 MB');
  });

  it('oltre il limite massimo il 413 del plugin esce in italiano con il codice stabile', async () => {
    const before = await snapshotOf(small);
    const huge = Buffer.concat([PDF, Buffer.alloc(4 * MIB)]);
    const response = await post(small, smallSigned, 'enorme.pdf', 'application/pdf', huge);
    await expectRejection(small, response, 413, 'MEDIA_TOO_LARGE', before);
    // Il messaggio dice il limite del tipo (PDF, 1 MB), non il massimo del plugin.
    expect(response.json().error.message).toContain('1 MB');
  });

  it('un corpo non multipart risponde 406 in italiano', async () => {
    const before = await snapshotOf(harness);
    const response = await harness.app.inject({
      method: 'POST',
      url: '/media',
      headers: { ...signed.writeHeaders, 'content-type': 'application/json' },
      payload: '{}',
    });
    await expectRejection(harness, response, 406, 'MEDIA_NOT_MULTIPART', before);
  });

  it('ammette PDF e MP4 con il proprio tipo', async () => {
    const pdf = await post(harness, signed, 'documento.pdf', 'text/plain', PDF);
    expect(pdf.statusCode).toBe(201);
    expect(pdf.json().mimeType).toBe('application/pdf');
    const video = await post(harness, signed, 'filmato.mp4', 'application/octet-stream', MP4);
    expect(video.statusCode).toBe(201);
    expect(video.json().mimeType).toBe('video/mp4');
  });
});

describe('nome del file e collisioni (S6)', () => {
  it('ripulisce il nome del file prima di usarlo', async () => {
    const response = await post(harness, signed, 'La Mia Foto è Più Bella.PNG', 'image/png', png);
    expect(response.statusCode).toBe(201);
    const media = response.json();
    expect(media.fileName).toBe('La-Mia-Foto-e-Piu-Bella.png');
    expect(media.storageKey.endsWith('/La-Mia-Foto-e-Piu-Bella.png')).toBe(true);
    expect(media.publicPath).toBe(`/media/${media.storageKey}`);
  });

  it('se il nome è già usato aggiunge -1, -2 e non sovrascrive mai l’oggetto esistente', async () => {
    const other = await synthetic('png', 21);
    const first = (await post(harness, signed, 'doppio.png', 'image/png', png)).json();
    const second = (await post(harness, signed, 'doppio.png', 'image/png', other)).json();
    const third = (await post(harness, signed, 'doppio.png', 'image/png', other)).json();

    expect(first.fileName).toBe('doppio.png');
    expect(second.fileName).toBe('doppio-1.png');
    expect(third.fileName).toBe('doppio-2.png');
    expect(harness.store.objects.get(`media-public/${first.storageKey}`)).toEqual(png);
    expect(harness.store.objects.get(`media-public/${second.storageKey}`)).toEqual(other);
  });

  it('conta anche i nomi delle derivate già registrate', async () => {
    const parent = (await post(harness, signed, 'madre.png', 'image/png', png)).json();
    const folder = parent.storageKey.slice(0, parent.storageKey.lastIndexOf('/'));
    await harness.db.insert(schema.mediaVariants).values({
      mediaId: parent.id,
      storageKey: `${folder}/occupato.png`,
      publicPath: `/media/${folder}/occupato.png`,
      width: 10,
      height: 10,
      byteSize: 1,
      checksum: Buffer.from('00', 'hex'),
    });

    const response = await post(harness, signed, 'occupato.png', 'image/png', png);
    expect(response.statusCode).toBe(201);
    expect(response.json().fileName).toBe('occupato-1.png');
  });
});

describe('se la scrittura fallisce non resta nulla', () => {
  it('un archivio che si rompe a metà non lascia righe né oggetti', async () => {
    const before = await snapshotOf(harness);
    const objectsBefore = harness.store.objects.size;
    const realPut = harness.store.put.bind(harness.store);
    harness.store.put = async (bucket, key, body, type) => {
      await realPut(bucket, key, body, type);
      throw new Error('archivio non raggiungibile');
    };
    try {
      const response = await post(harness, signed, 'a-meta.png', 'image/png', png);
      expect(response.statusCode).toBe(500);
      expect(response.json().error.message).toBe('Errore interno del servizio.');
    } finally {
      harness.store.put = realPut;
    }
    expect(await mediaRows(harness)).toBe(before.rows);
    expect(harness.store.objects.size).toBe(objectsBefore);
  });

  it('se la riga non si scrive nessun oggetto viene caricato', async () => {
    const before = await snapshotOf(harness);
    const target = harness.db as unknown as { transaction: unknown };
    const real = target.transaction;
    target.transaction = async () => {
      throw new Error('database non raggiungibile');
    };
    try {
      const response = await post(harness, signed, 'senza-riga.png', 'image/png', png);
      expect(response.statusCode).toBe(500);
    } finally {
      target.transaction = real;
    }
    expect(harness.store.puts.length).toBe(before.puts);
    expect(await mediaRows(harness)).toBe(before.rows);
  });
});

describe('sostituzione: codici stabili e rifiuti', () => {
  it('409 MEDIA_TYPE_CHANGED quando il tipo cambia', async () => {
    const media = (await post(harness, signed, 'resta.png', 'image/png', png)).json();
    const { payload, headers } = multipart(signed, 'altro.jpg', 'image/png', jpeg);
    const response = await harness.app.inject({
      method: 'PUT',
      url: `/media/${media.id}/file`,
      headers,
      payload,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MEDIA_TYPE_CHANGED');
  });

  it('rifiuta un file di tipo non ammesso senza scrivere', async () => {
    const media = (await post(harness, signed, 'intatto.png', 'image/png', png)).json();
    const before = await snapshotOf(harness);
    const { payload, headers } = multipart(
      signed,
      'x.png',
      'image/png',
      Buffer.from('<html></html>'),
    );
    const response = await harness.app.inject({
      method: 'PUT',
      url: `/media/${media.id}/file`,
      headers,
      payload,
    });
    await expectRejection(harness, response, 415, 'MEDIA_TYPE_NOT_ALLOWED', before);
  });
});

describe('correzioni del giro di revisione', () => {
  it('due caricamenti concorrenti dello stesso nome riescono, con nomi diversi', async () => {
    const results = await Promise.all([
      post(harness, signed, 'x.png', 'image/png', png),
      post(harness, signed, 'x.png', 'image/png', png),
    ]);
    expect(results.map((response) => response.statusCode)).toEqual([201, 201]);
    expect(results.map((response) => response.json().fileName).sort()).toEqual([
      'x-1.png',
      'x.png',
    ]);
  });

  it('un JPEG con un difetto da semplice avviso si accetta, uno troncato no', async () => {
    const noise = Buffer.alloc(100 * 100 * 3);
    for (let i = 0; i < noise.length; i += 1) noise[i] = (i * 7919) % 251;
    const clean = await sharp(noise, { raw: { width: 100, height: 100, channels: 3 } })
      .jpeg()
      .toBuffer();
    const at = Math.floor(clean.length / 2);
    // Dati corrotti a metà del flusso: il decodificatore avvisa ma l'immagine si legge.
    const warned = Buffer.concat([
      clean.subarray(0, at),
      Buffer.from([0xff, 0x05, 0xaa, 0xbb]),
      clean.subarray(at),
    ]);
    const response = await post(harness, signed, 'telefono.jpg', 'image/jpeg', warned);
    expect(response.statusCode).toBe(201);
  });

  it('un nome lunghissimo si accorcia e il caricamento riesce', async () => {
    expect(sanitizeFileName(`${'a'.repeat(400)}.png`)).toBe(`${'a'.repeat(100)}.png`);
    const response = await post(harness, signed, `${'b'.repeat(400)}.png`, 'image/png', png);
    expect(response.statusCode).toBe(201);
    expect(response.json().fileName.length).toBeLessThanOrEqual(110);
  });

  it('riconosce l’MP4 dalle marche principali e compatibili, non il solo QuickTime', () => {
    const ftyp = (major: string, ...compatible: string[]) => {
      const body = Buffer.from(major + '\0\0\0\0' + compatible.join(''), 'latin1');
      const head = Buffer.alloc(8);
      head.writeUInt32BE(8 + body.length);
      head.write('ftyp', 4, 'latin1');
      return Buffer.concat([head, body]);
    };
    for (const major of ['MSNV', 'XAVC', 'mmp4', '3gp4', '3gp5', '3gp6', 'M4V ']) {
      expect(detectMime(ftyp(major))).toBe('video/mp4');
    }
    expect(detectMime(ftyp('qt  ', 'qt  ', 'isom'))).toBe('video/mp4');
    expect(detectMime(ftyp('qt  ', 'qt  '))).toBeNull();
    expect(detectMime(ftyp('M4A ', 'M4A '))).toBeNull();
  });
});
