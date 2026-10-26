import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { derivativeFileName, planDerivatives, sourceBaseName } from '../src/modules/media/sizes.js';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Dimensioni derivate (DR-225, D145-A): nascono al caricamento, si rigenerano alla
 * sostituzione, e una sostituzione che farebbe sparire una derivata citata si rifiuta (D146-A).
 * Anche la cache dei file (D149-A).
 *
 * Nessun dato reale: le immagini sono a tinta unita, generate qui.
 */

let harness: Harness;
let signed: Signed;
let counter = 0;

beforeAll(async () => {
  harness = await createHarness('api_media_variants');
  signed = await signIn(harness, { area: 'redazione' });
}, 180_000);

afterAll(async () => {
  await harness?.teardown();
});

type Format = 'jpeg' | 'png' | 'webp';
const EXTENSION = { jpeg: 'jpg', png: 'png', webp: 'webp' } as const;

interface ImageOptions {
  readonly format?: Format;
  readonly color?: { r: number; g: number; b: number };
  /** Orientamento EXIF, con una riga di GPS e di marca della fotocamera. */
  readonly orientation?: number;
}

async function image(width: number, height: number, options: ImageOptions = {}): Promise<Buffer> {
  const { format = 'jpeg', color = { r: 200, g: 40, b: 40 }, orientation } = options;
  let pipeline = sharp({ create: { width, height, channels: 3, background: color } })[format]();
  if (orientation) {
    pipeline = pipeline
      .withExif({
        IFD0: { Make: 'MarcaFinta', Copyright: 'sintetico' },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '41/1 54/1 0/1',
          GPSLongitudeRef: 'E',
          GPSLongitude: '12/1 30/1 0/1',
        },
      })
      .withMetadata({ orientation });
  }
  return pipeline.toBuffer();
}

const PDF = Buffer.from('%PDF-1.4\n% documento sintetico\n%%EOF\n');
const PDF_2 = Buffer.from('%PDF-1.4\n% altro documento sintetico\n%%EOF\n');
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from('ftypisom'),
  Buffer.from([0, 0, 2, 0]),
  Buffer.from('isomiso2'),
]);

function multipart(fileName: string, mimeType: string, body: Buffer) {
  const boundary = '----prova-sintetica';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `content-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `content-type: ${mimeType}\r\n\r\n`,
  );
  return {
    payload: Buffer.concat([head, body, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    headers: {
      ...signed.writeHeaders,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
  };
}

interface MediaJson {
  id: string;
  publicPath: string;
  storageKey: string;
  fileName: string;
  width: number | null;
  height: number | null;
  derivatives: number;
}

interface ReplacedJson extends Omit<MediaJson, 'derivatives'> {
  derivatives: { written: number; removed: number };
}

async function upload(fileName: string, body: Buffer, mimeType = 'image/jpeg') {
  const { payload, headers } = multipart(fileName, mimeType, body);
  return harness.app.inject({ method: 'POST', url: '/media', headers, payload });
}

async function uploaded(fileName: string, body: Buffer, mimeType = 'image/jpeg') {
  const response = await upload(fileName, body, mimeType);
  expect(response.statusCode).toBe(201);
  return response.json() as MediaJson;
}

async function replace(id: string, fileName: string, body: Buffer, mimeType = 'image/jpeg') {
  const { payload, headers } = multipart(fileName, mimeType, body);
  return harness.app.inject({ method: 'PUT', url: `/media/${id}/file`, headers, payload });
}

const unique = (stem: string): string => `${stem}-${(counter += 1)}`;
const bucketKey = (key: string): string => `media-public/${key}`;
const folderOf = (key: string): string => key.slice(0, key.lastIndexOf('/'));

async function variantRows(id: string) {
  return harness.db
    .select()
    .from(schema.mediaVariants)
    .where(eq(schema.mediaVariants.mediaId, id))
    .orderBy(schema.mediaVariants.publicPath);
}

async function mediaRow(id: string) {
  const [row] = await harness.db.select().from(schema.media).where(eq(schema.media.id, id));
  if (!row) throw new Error('media assente');
  return row;
}

async function sizeOf(key: string): Promise<{ width: number; height: number }> {
  const stored = harness.store.objects.get(bucketKey(key));
  if (!stored) throw new Error(`oggetto assente: ${key}`);
  const { width, height } = await sharp(stored).metadata();
  return { width: width ?? 0, height: height ?? 0 };
}

const named = (rows: readonly { width: number; height: number }[]): string[] =>
  rows.map((row) => `${row.width}x${row.height}`).sort();
const planned = (width: number, height: number): string[] =>
  named(planDerivatives({ width, height }));

/** Righe, oggetti e misure del media sono quelli che S8 prevede per le sue misure. */
async function expectCoherent(id: string): Promise<void> {
  const row = await mediaRow(id);
  const rows = await variantRows(id);
  expect(row.width).not.toBeNull();
  expect(named(rows)).toEqual(planned(row.width ?? 0, row.height ?? 0));
  expect(await sizeOf(row.storageKey)).toEqual({ width: row.width, height: row.height });
  for (const variant of rows) {
    expect(await sizeOf(variant.storageKey)).toEqual({
      width: variant.width,
      height: variant.height,
    });
  }
  const { base } = sourceBaseName(row.storageKey.split('/').pop() ?? '');
  const folder = folderOf(row.storageKey);
  const owned = new Set(rows.map((variant) => bucketKey(variant.storageKey)));
  const pattern = new RegExp(String.raw`^media-public/${folder}/${base}-\d+x\d+\.[a-z]+$`);
  const stray = [...harness.store.objects.keys()].filter(
    (key) => pattern.test(key) && !owned.has(key),
  );
  expect(stray).toEqual([]);
}

/** Raccoglie gli errori che le richieste registrano nel log, con il loro contesto. */
function captureErrors() {
  const calls: unknown[][] = [];
  const realChild = harness.app.log.child.bind(harness.app.log);
  const spy = vi.spyOn(harness.app.log, 'child').mockImplementation(((...args: never[]) => {
    const child = realChild(...args);
    const original = child.error.bind(child);
    (child as { error: unknown }).error = (...entry: unknown[]) => {
      calls.push(entry);
      return (original as (...a: unknown[]) => void)(...entry);
    };
    return child;
  }) as never);
  return { calls, restore: () => spy.mockRestore() };
}

/** Ferma la prima scrittura nell'archivio finché non si chiama `release`. */
function pauseFirstPut() {
  const originalPut = harness.store.put;
  let release: () => void = () => undefined;
  let started: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const reached = new Promise<void>((resolve) => (started = resolve));
  let first = true;
  harness.store.put = async (...args) => {
    if (first) {
      first = false;
      started();
      await gate;
    }
    return originalPut(...args);
  };
  return {
    started: reached,
    release,
    restore: () => {
      release();
      harness.store.put = originalPut;
    },
  };
}

/** Ogni percorso è di una sola riga e il suo oggetto ha l'impronta di quella riga. */
async function expectOwnership(): Promise<void> {
  const media = await harness.db.select().from(schema.media);
  const variants = await harness.db.select().from(schema.mediaVariants);
  const rows = [
    ...media.map((row) => ({ key: row.storageKey, path: row.publicPath, sum: row.checksum })),
    ...variants.map((row) => ({ key: row.storageKey, path: row.publicPath, sum: row.checksum })),
  ];
  expect(new Set(rows.map((row) => row.path)).size).toBe(rows.length);
  for (const row of rows) {
    const stored = harness.store.objects.get(bucketKey(row.key));
    // Le righe inserite a mano nelle prove non hanno oggetto.
    if (stored) expect(createHash('sha256').update(stored).digest().equals(row.sum)).toBe(true);
  }
}

async function cite(title: string, blocks: unknown[]): Promise<void> {
  const slug = unique('pagina-sintetica');
  await harness.db.insert(schema.contents).values({
    type: 'page',
    status: 'draft',
    slug,
    path: `/${slug}/`,
    title,
    blocks: { schema: 1, blocks },
  });
}

const imageBlock = (mediaId: string, variant: string | null) => ({
  type: 'image',
  id: `b_${String(counter).padStart(12, '0')}`,
  props: { mediaId, variant, alt: 'Immagine inventata.' },
  children: [],
});

const htmlBlock = (html: string) => ({
  type: 'html',
  id: `b_${String(counter + 500).padStart(12, '0')}`,
  props: { html },
  children: [],
});

describe('caricamento di un’immagine (D145-A)', () => {
  it('risponde con larghezza, altezza e numero di derivate; righe e oggetti hanno i nomi <base>-LxA', async () => {
    const stem = unique('orizzontale');
    const media = await uploaded(`${stem}.jpg`, await image(2000, 1500));

    expect(media.width).toBe(2000);
    expect(media.height).toBe(1500);
    expect(media.derivatives).toBe(14);

    const rows = await variantRows(media.id);
    expect(rows).toHaveLength(14);
    const folder = folderOf(media.storageKey);
    expect(rows.map((row) => row.publicPath).sort()).toEqual(
      planDerivatives({ width: 2000, height: 1500 })
        .map(
          (plan) => `/media/${folder}/${derivativeFileName(stem, 'jpg', plan.width, plan.height)}`,
        )
        .sort(),
    );
    await expectCoherent(media.id);
  });

  it('PNG e WebP: derivate nello stesso formato dell’originale', async () => {
    for (const format of ['png', 'webp'] as const) {
      const media = await uploaded(
        `${unique('formato')}.${EXTENSION[format]}`,
        await image(1200, 800, { format }),
        `image/${format}`,
      );
      const rows = await variantRows(media.id);
      expect(rows.length).toBeGreaterThan(5);
      for (const row of rows) {
        const stored = harness.store.objects.get(bucketKey(row.storageKey));
        expect((await sharp(stored).metadata()).format).toBe(format);
        expect(row.publicPath.endsWith(`.${EXTENSION[format]}`)).toBe(true);
      }
      await expectCoherent(media.id);
    }
  });

  it('un’immagine piccola ha solo il ritaglio che non ingrandisce', async () => {
    const media = await uploaded(`${unique('piccola')}.jpg`, await image(200, 100));
    expect(media.derivatives).toBe(1);
    expect(named(await variantRows(media.id))).toEqual(['150x100']);
  });

  it('originale e derivate senza EXIF né GPS, con l’orientamento applicato', async () => {
    const source = await image(300, 200, { orientation: 6 });
    const header = await sharp(source).metadata();
    expect(header.exif).toBeDefined();
    // Prova che il file di partenza porti davvero il puntatore al blocco GPS (tag 0x8825).
    expect(header.exif?.includes(Buffer.from([0x25, 0x88]))).toBe(true);

    const media = await uploaded(`${unique('verticale-exif')}.jpg`, source);
    // 300x200 con orientamento 6 si vede 200x300.
    expect(media.width).toBe(200);
    expect(media.height).toBe(300);

    const keys = [media.storageKey, ...(await variantRows(media.id)).map((row) => row.storageKey)];
    expect(keys.length).toBeGreaterThan(2);
    for (const key of keys) {
      const stored = harness.store.objects.get(bucketKey(key));
      const meta = await sharp(stored).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
    }
    await expectCoherent(media.id);
  });

  it('i colori restano quelli di partenza, in sRGB e senza profilo, in originale e derivate', async () => {
    const media = await uploaded(
      `${unique('colori')}.jpg`,
      await image(900, 600, { color: { r: 30, g: 120, b: 210 } }),
    );
    const keys = [media.storageKey, ...(await variantRows(media.id)).map((row) => row.storageKey)];
    for (const key of keys) {
      const stats = await sharp(harness.store.objects.get(bucketKey(key))).stats();
      const [red, green, blue] = stats.channels.map((channel) => Math.round(channel.mean));
      expect(Math.abs((red ?? 0) - 30)).toBeLessThanOrEqual(3);
      expect(Math.abs((green ?? 0) - 120)).toBeLessThanOrEqual(3);
      expect(Math.abs((blue ?? 0) - 210)).toBeLessThanOrEqual(3);
    }
  });

  it('oltre 2560 px l’originale si riduce e si chiama <base>-scaled; le derivate usano <base> e partono dall’originale intero', async () => {
    const stem = unique('enorme');
    const media = await uploaded(`${stem}.jpg`, await image(4000, 3000));

    expect(media.fileName).toBe(`${stem}-scaled.jpg`);
    expect(media.publicPath.endsWith(`/${stem}-scaled.jpg`)).toBe(true);
    expect(media.width).toBe(2560);
    expect(media.height).toBe(1920);
    expect(await sizeOf(media.storageKey)).toEqual({ width: 2560, height: 1920 });

    const rows = await variantRows(media.id);
    // Le misure derivate si calcolano sull'originale 4000x3000, le responsive sul file ridotto.
    expect(named(rows)).toEqual(
      named(planDerivatives({ width: 4000, height: 3000 }, { width: 2560, height: 1920 })),
    );
    expect(named(rows)).toContain('2880x1800');
    expect(named(rows)).toContain('2048x1536');
    for (const row of rows) {
      expect(row.publicPath).toMatch(new RegExp(`/${stem}-\\d+x\\d+\\.jpg$`));
      expect(await sizeOf(row.storageKey)).toEqual({ width: row.width, height: row.height });
    }
  }, 60_000);

  it('il nome è unico anche per le derivate: un originale chiamato X-150x150.jpg fa scegliere X-1.jpg', async () => {
    const stem = unique('occupato');
    const first = await uploaded(`${stem}-150x150.jpg`, await image(800, 600));
    // Nessun altro `X.jpg`: solo la derivata 150x150 dell'immagine nuova collide.
    const second = await uploaded(`${stem}.jpg`, await image(2000, 1500));
    expect(second.fileName).toBe(`${stem}-1.jpg`);
    await expectCoherent(first.id);
    await expectCoherent(second.id);
    await expectOwnership();
  });

  it('rifiuta un’immagine animata: un WebP con più fotogrammi e un APNG', async () => {
    const frame = (background: string) =>
      sharp({ create: { width: 20, height: 20, channels: 3, background } })
        .png()
        .toBuffer();
    const animated = await sharp([await frame('#c82828'), await frame('#28c828')], {
      join: { animated: true },
    })
      .webp()
      .toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);

    const chunk = (type: string, data: Buffer): Buffer => {
      const head = Buffer.concat([Buffer.from(type), data]);
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(head));
      return Buffer.concat([length, head, crc]);
    };
    const still = await image(20, 20, { format: 'png' });
    const control = Buffer.alloc(8);
    control.writeUInt32BE(2, 0);
    // Il blocco acTL sta subito dopo IHDR (8 byte di firma + 25 di IHDR).
    const apng = Buffer.concat([still.subarray(0, 33), chunk('acTL', control), still.subarray(33)]);

    const rows = await harness.db.select().from(schema.media);
    for (const [name, body, mime] of [
      ['animata.webp', animated, 'image/webp'],
      ['animata.png', apng, 'image/png'],
    ] as const) {
      const response = await upload(name, body, mime);
      expect(response.statusCode).toBe(415);
      const { error } = response.json() as { error: { code: string; message: string } };
      expect(error.code).toBe('MEDIA_TYPE_NOT_ALLOWED');
      expect(error.message).toContain('animata');
    }
    expect(await harness.db.select().from(schema.media)).toHaveLength(rows.length);
  });

  it('un PDF e un video non hanno derivate né misure', async () => {
    const pdf = await uploaded(`${unique('documento')}.pdf`, PDF, 'application/pdf');
    expect(pdf.derivatives).toBe(0);
    expect(pdf.width).toBeNull();
    expect(pdf.height).toBeNull();
    const video = await uploaded(`${unique('filmato')}.mp4`, MP4, 'video/mp4');
    expect(video.derivatives).toBe(0);
    expect(video.width).toBeNull();
    expect(await variantRows(video.id)).toHaveLength(0);
  });

  it('un errore dell’archivio non lascia né righe né oggetti', async () => {
    const before = harness.store.objects.size;
    const rowsBefore = (await harness.db.select().from(schema.media)).length;
    const variantsBefore = (await harness.db.select().from(schema.mediaVariants)).length;
    const originalPut = harness.store.put;
    let calls = 0;
    harness.store.put = async (...args) => {
      calls += 1;
      if (calls === 4) throw new Error('rete interrotta (prova)');
      return originalPut(...args);
    };
    try {
      const response = await upload(`${unique('fallito')}.jpg`, await image(1500, 1000));
      expect(response.statusCode).toBe(500);
    } finally {
      harness.store.put = originalPut;
    }
    expect(harness.store.objects.size).toBe(before);
    expect(await harness.db.select().from(schema.media)).toHaveLength(rowsBefore);
    expect(await harness.db.select().from(schema.mediaVariants)).toHaveLength(variantsBefore);
  });
});

describe('sostituzione del file (S9, D146-A)', () => {
  it('stesso indirizzo, misure e impronta nuove; derivate riscritte, aggiunte e tolte', async () => {
    const media = await uploaded(`${unique('sostituita')}.jpg`, await image(2000, 1500));
    const before = await mediaRow(media.id);
    const oldRows = await variantRows(media.id);

    // Stesse proporzioni, più piccola: spariscono le misure che ingrandirebbero.
    const response = await replace(
      media.id,
      'qualunque-nome.jpg',
      await image(1000, 750, { color: { r: 10, g: 90, b: 200 } }),
    );
    expect(response.statusCode).toBe(200);
    const body = response.json() as ReplacedJson;

    expect(body.publicPath).toBe(media.publicPath);
    expect(body.storageKey).toBe(media.storageKey);
    expect(body.width).toBe(1000);
    expect(body.height).toBe(750);
    const after = await mediaRow(media.id);
    expect(after.checksum.equals(before.checksum)).toBe(false);

    const newRows = await variantRows(media.id);
    const oldPaths = new Set(oldRows.map((row) => row.publicPath));
    const removed = oldRows.filter(
      (row) => !newRows.some((newRow) => newRow.publicPath === row.publicPath),
    );
    expect(body.derivatives).toEqual({ written: newRows.length, removed: removed.length });
    expect(removed.length).toBeGreaterThan(0);
    // Quelle con lo stesso nome conservano percorso e chiave (si riscrivono sul posto); altre sono nuove.
    const common = newRows.filter((row) => oldPaths.has(row.publicPath));
    expect(common.length).toBeGreaterThan(5);
    expect(common.length).toBeLessThan(newRows.length);
    for (const row of common) {
      const was = oldRows.find((old) => old.publicPath === row.publicPath);
      expect(was?.id).toBe(row.id);
      expect(was?.checksum.equals(row.checksum)).toBe(false);
    }
    for (const row of removed) {
      expect(harness.store.objects.has(bucketKey(row.storageKey))).toBe(false);
    }
    await expectCoherent(media.id);
  });

  it('con le stesse proporzioni le derivate che mancavano si aggiungono', async () => {
    const media = await uploaded(`${unique('cresciuta')}.jpg`, await image(500, 375));
    const before = named(await variantRows(media.id));
    const response = await replace(media.id, 'x.jpg', await image(2000, 1500));
    expect(response.statusCode).toBe(200);
    const body = response.json() as ReplacedJson;
    // Le misure che non ci sono più nella nuova immagine sono quelle tolte.
    const after = planned(2000, 1500);
    expect(body.derivatives.removed).toBe(before.filter((size) => !after.includes(size)).length);
    expect(body.derivatives.written).toBe(14);
    expect(body.derivatives.written).toBeGreaterThan(before.length);
    await expectCoherent(media.id);
  });

  it('un originale nuovo oltre 2560 px si riduce sull’indirizzo di sempre', async () => {
    const media = await uploaded(`${unique('da-ridurre')}.jpg`, await image(2000, 1500));
    const response = await replace(media.id, 'x.jpg', await image(3200, 2400));
    expect(response.statusCode).toBe(200);
    const body = response.json() as ReplacedJson;
    expect(body.storageKey).toBe(media.storageKey);
    expect(body.width).toBe(2560);
    expect(body.height).toBe(1920);
    expect(await sizeOf(media.storageKey)).toEqual({ width: 2560, height: 1920 });
  }, 60_000);

  it('409 MEDIA_VARIANT_IN_USE se un blocco sceglie una derivata proporzionale che sparirebbe, senza scrivere', async () => {
    const media = await uploaded(`${unique('scelta')}.jpg`, await image(2000, 1500));
    await cite('Pagina che sceglie la derivata', [imageBlock(media.id, '300x225')]);
    const before = await mediaRow(media.id);
    const rowsBefore = await variantRows(media.id);
    const putsBefore = harness.store.puts.length;

    // Proporzioni diverse: 300x225 diventa 200x300 e la derivata citata non esiste più.
    const response = await replace(media.id, 'x.jpg', await image(1000, 1500));

    expect(response.statusCode).toBe(409);
    const { error } = response.json() as { error: { code: string; message: string } };
    expect(error.code).toBe('MEDIA_VARIANT_IN_USE');
    expect(error.message).toContain('Pagina che sceglie la derivata');
    expect(harness.store.puts.length).toBe(putsBefore);
    const after = await mediaRow(media.id);
    expect(after.checksum.equals(before.checksum)).toBe(true);
    expect(after.width).toBe(2000);
    expect(await variantRows(media.id)).toEqual(rowsBefore);
  });

  it('409 anche se un testo cita l’indirizzo della derivata', async () => {
    const media = await uploaded(`${unique('indirizzo')}.jpg`, await image(2000, 1500));
    const folder = folderOf(media.storageKey);
    const stem = sourceBaseName(media.fileName).base;
    await cite('Pagina con l’indirizzo', [
      htmlBlock(`<img src="/media/${folder}/${stem}-768x576.jpg" alt="">`),
    ]);

    const response = await replace(media.id, 'x.jpg', await image(1000, 1500));
    expect(response.statusCode).toBe(409);
    const { error } = response.json() as { error: { code: string; message: string } };
    expect(error.code).toBe('MEDIA_VARIANT_IN_USE');
    expect(error.message).toContain('Pagina con l’indirizzo');
  });

  it('i titoli nel messaggio sono al massimo dieci', async () => {
    const media = await uploaded(`${unique('molte')}.jpg`, await image(2000, 1500));
    for (let n = 1; n <= 12; n += 1) {
      await cite(`Pagina numero ${n}`, [imageBlock(media.id, '300x225')]);
    }
    const response = await replace(media.id, 'x.jpg', await image(1000, 1500));
    expect(response.statusCode).toBe(409);
    const { error } = response.json() as { error: { message: string } };
    expect(error.message.match(/Pagina numero/g)).toHaveLength(10);
  });

  it('una derivata con ritaglio citata conserva il nome e si riscrive: la sostituzione passa', async () => {
    const media = await uploaded(`${unique('ritaglio')}.jpg`, await image(2000, 1500));
    await cite('Pagina con il ritaglio', [imageBlock(media.id, '400x250')]);

    const response = await replace(
      media.id,
      'x.jpg',
      await image(1000, 1500, { color: { r: 1, g: 2, b: 3 } }),
    );
    expect(response.statusCode).toBe(200);
    expect(named(await variantRows(media.id))).toContain('400x250');
    await expectCoherent(media.id);
  });

  it('non conta la derivata di un altro media né una che resta', async () => {
    const media = await uploaded(`${unique('precisione')}.jpg`, await image(2000, 1500));
    const other = await uploaded(`${unique('altro')}.jpg`, await image(2000, 1500));
    await cite('Pagina di un altro media', [imageBlock(other.id, '300x225')]);
    await cite('Pagina con una derivata che resta', [imageBlock(media.id, '300x225')]);

    // Stesse proporzioni: 300x225 resta, e quella di un altro media non è affar suo.
    const response = await replace(media.id, 'x.jpg', await image(1000, 750));
    expect(response.statusCode).toBe(200);
  });

  it('PDF: le anteprime si tolgono, righe e oggetti; se un contenuto le citasse, vale D146-A', async () => {
    const pdf = await uploaded(`${unique('dispensa')}.pdf`, PDF, 'application/pdf');
    const folder = folderOf(pdf.storageKey);
    const stem = sourceBaseName(pdf.fileName).base;
    const preview = await image(116, 150);
    const addPreview = async (suffix: string) => {
      const key = `${folder}/${stem}-${suffix}.jpg`;
      await harness.db.insert(schema.mediaVariants).values({
        mediaId: pdf.id,
        storageKey: key,
        publicPath: `/media/${key}`,
        width: 116,
        height: 150,
        byteSize: preview.length,
        checksum: Buffer.from(suffix),
      });
      harness.store.objects.set(bucketKey(key), preview);
      return key;
    };

    const citedKey = await addPreview('pdf-116x150');
    await cite('Pagina che cita l’anteprima', [htmlBlock(`<img src="/media/${citedKey}">`)]);
    const refused = await replace(pdf.id, 'x.pdf', PDF_2, 'application/pdf');
    expect(refused.statusCode).toBe(409);
    expect((refused.json() as { error: { code: string } }).error.code).toBe('MEDIA_VARIANT_IN_USE');
    expect(await variantRows(pdf.id)).toHaveLength(1);

    // Senza la citazione le anteprime si tolgono.
    await harness.db.delete(schema.contents);
    const secondKey = await addPreview('pdf-58x75');
    const ok = await replace(pdf.id, 'x.pdf', PDF_2, 'application/pdf');
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as ReplacedJson).derivatives).toEqual({ written: 0, removed: 2 });
    expect(await variantRows(pdf.id)).toHaveLength(0);
    expect(harness.store.objects.has(bucketKey(secondKey))).toBe(false);
    expect(harness.store.objects.has(bucketKey(citedKey))).toBe(false);
    expect(harness.store.objects.get(bucketKey(pdf.storageKey))?.equals(PDF_2)).toBe(true);
  });

  it('video: sostituito il file, larghezza e altezza diventano nulle', async () => {
    const video = await uploaded(`${unique('video')}.mp4`, MP4, 'video/mp4');
    await harness.db
      .update(schema.media)
      .set({ width: 1920, height: 1080 })
      .where(eq(schema.media.id, video.id));
    const other = Buffer.concat([MP4, Buffer.from('altri-byte-sintetici')]);
    const response = await replace(video.id, 'x.mp4', other, 'video/mp4');
    expect(response.statusCode).toBe(200);
    const row = await mediaRow(video.id);
    expect(row.width).toBeNull();
    expect(row.height).toBeNull();
  });

  it('409 MEDIA_TYPE_CHANGED resta e non scrive', async () => {
    const media = await uploaded(`${unique('tipo')}.jpg`, await image(300, 200));
    const putsBefore = harness.store.puts.length;
    const response = await replace(
      media.id,
      'x.png',
      await image(300, 200, { format: 'png' }),
      'image/png',
    );
    expect(response.statusCode).toBe(409);
    expect((response.json() as { error: { code: string } }).error.code).toBe('MEDIA_TYPE_CHANGED');
    expect(harness.store.puts.length).toBe(putsBefore);
  });

  it('due sostituzioni simultanee dello stesso media si mettono in fila', async () => {
    const media = await uploaded(`${unique('concorrente')}.jpg`, await image(2000, 1500));
    const originalPut = harness.store.put;
    let inFlight = 0;
    let overlap = 0;
    harness.store.put = async (...args) => {
      inFlight += 1;
      overlap = Math.max(overlap, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 4));
      try {
        return await originalPut(...args);
      } finally {
        inFlight -= 1;
      }
    };
    try {
      const [first, second] = await Promise.all([
        replace(media.id, 'a.jpg', await image(1500, 2000, { color: { r: 5, g: 5, b: 5 } })),
        replace(media.id, 'b.jpg', await image(2000, 1500, { color: { r: 250, g: 250, b: 5 } })),
      ]);
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
    } finally {
      harness.store.put = originalPut;
    }
    expect(overlap).toBe(1);
    await expectCoherent(media.id);
  });

  it('una sostituzione interrotta a metà si ripete con lo stesso file e il log ha l’id', async () => {
    const media = await uploaded(`${unique('interrotta')}.jpg`, await image(2000, 1500));
    const before = await mediaRow(media.id);
    const next = await image(1500, 2000, { color: { r: 9, g: 99, b: 199 } });

    const originalPut = harness.store.put;
    const logged = captureErrors();
    let calls = 0;
    harness.store.put = async (...args) => {
      calls += 1;
      if (calls === 4) throw new Error('rete interrotta (prova)');
      return originalPut(...args);
    };
    try {
      const response = await replace(media.id, 'x.jpg', next);
      expect(response.statusCode).toBe(500);
    } finally {
      harness.store.put = originalPut;
    }
    expect(JSON.stringify(logged.calls)).toContain(media.id);
    logged.restore();

    // Il media resta leggibile e invariato a database.
    const read = await harness.app.inject({ method: 'GET', url: media.publicPath });
    expect(read.statusCode).toBe(200);
    const interrupted = await mediaRow(media.id);
    expect(interrupted.checksum.equals(before.checksum)).toBe(true);

    const retry = await replace(media.id, 'x.jpg', next);
    expect(retry.statusCode).toBe(200);
    await expectCoherent(media.id);
    expect((await mediaRow(media.id)).width).toBe(1500);
  });

  it('409 anche con le stesse proporzioni se il file nuovo è più piccolo, e il messaggio non presume la causa', async () => {
    const media = await uploaded(`${unique('piu-piccola')}.jpg`, await image(2000, 1500));
    await cite('Pagina con la derivata grande', [imageBlock(media.id, '1024x768')]);
    const putsBefore = harness.store.puts.length;

    const response = await replace(media.id, 'x.jpg', await image(800, 600));

    expect(response.statusCode).toBe(409);
    const { error } = response.json() as { error: { code: string; message: string } };
    expect(error.code).toBe('MEDIA_VARIANT_IN_USE');
    expect(error.message).toContain('Pagina con la derivata grande');
    expect(error.message).toContain('almeno così grande');
    expect(error.message).not.toContain('proporzioni diverse');
    expect(harness.store.puts.length).toBe(putsBefore);
  });

  it('per un PDF il messaggio parla di anteprima, non di proporzioni', async () => {
    const pdf = await uploaded(`${unique('relazione')}.pdf`, PDF, 'application/pdf');
    const key = `${folderOf(pdf.storageKey)}/${sourceBaseName(pdf.fileName).base}-pdf-116x150.jpg`;
    await harness.db.insert(schema.mediaVariants).values({
      mediaId: pdf.id,
      storageKey: key,
      publicPath: `/media/${key}`,
      width: 116,
      height: 150,
      byteSize: 1,
      checksum: Buffer.from('p'),
    });
    await cite('Pagina con l’anteprima del PDF', [htmlBlock(`<img src="/media/${key}">`)]);
    const response = await replace(pdf.id, 'x.pdf', PDF_2, 'application/pdf');
    expect(response.statusCode).toBe(409);
    const { message } = (response.json() as { error: { message: string } }).error;
    expect(message).toContain('anteprima');
    expect(message).not.toContain('proporzioni');
    expect(message).not.toContain('immagine');
  });

  it('la pulizia degli oggetti sparsi sta sotto lo stesso blocco: una sostituzione in coda non perde un oggetto', async () => {
    const media = await uploaded(`${unique('pulizia')}.jpg`, await image(1000, 750));
    const vanishingKey = `${folderOf(media.storageKey)}/${sourceBaseName(media.fileName).base}-300x225.jpg`;
    const originalRemove = harness.store.remove;
    let removing: () => void = () => undefined;
    const started = new Promise<void>((resolve) => (removing = resolve));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    harness.store.remove = async (bucket, key) => {
      if (key === vanishingKey) {
        removing();
        await gate;
      }
      return originalRemove(bucket, key);
    };
    try {
      // A -> B: 300x225 sparisce e la sua pulizia si ferma sul cancello.
      const first = replace(media.id, 'b.jpg', await image(750, 1000));
      await started;
      // B -> A in coda: 300x225 torna a essere una derivata nuova.
      const second = replace(
        media.id,
        'a.jpg',
        await image(1000, 750, { color: { r: 7, g: 7, b: 7 } }),
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      release();
      expect((await first).statusCode).toBe(200);
      expect((await second).statusCode).toBe(200);
    } finally {
      release();
      harness.store.remove = originalRemove;
    }
    expect(harness.store.objects.has(bucketKey(vanishingKey))).toBe(true);
    await expectCoherent(media.id);
    await expectOwnership();
  });

  it('due caricamenti simultanei nella stessa cartella non scelgono lo stesso percorso', async () => {
    const stem = unique('gara');
    const pause = pauseFirstPut();
    try {
      const first = upload(`${stem}.jpg`, await image(2000, 1500));
      await pause.started;
      // `<stem>-300x225.jpg` è il nome di una derivata del primo, che non ha ancora confermato.
      const second = upload(
        `${stem}-300x225.jpg`,
        await image(800, 600, { color: { r: 9, g: 9, b: 9 } }),
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      pause.release();
      expect((await first).statusCode).toBe(201);
      expect((await second).statusCode).toBe(201);
    } finally {
      pause.restore();
    }
    await expectOwnership();
  });

  it('una sostituzione e un caricamento simultanei non si sovrascrivono', async () => {
    const stem = unique('gara-sostituzione');
    const media = await uploaded(`${stem}.jpg`, await image(500, 375));
    const base = sourceBaseName(media.fileName).base;
    const pause = pauseFirstPut();
    try {
      // La sostituzione genera `<base>-1080x810.jpg`, che il caricamento sceglie come nome.
      const replaced = replace(
        media.id,
        'x.jpg',
        await image(2000, 1500, { color: { r: 3, g: 3, b: 3 } }),
      );
      await pause.started;
      const uploadedNow = upload(
        `${base}-1080x810.jpg`,
        await image(800, 600, { color: { r: 200, g: 200, b: 9 } }),
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      pause.release();
      expect((await replaced).statusCode).toBe(200);
      expect((await uploadedNow).statusCode).toBe(201);
    } finally {
      pause.restore();
    }
    await expectOwnership();
  });

  it('un errore nel togliere le derivate sparite non rovescia la sostituzione e va nel log con l’id', async () => {
    const media = await uploaded(`${unique('pulizia-fallita')}.jpg`, await image(2000, 1500));
    const originalRemove = harness.store.remove;
    harness.store.remove = async () => {
      throw new Error('archivio non raggiungibile (prova)');
    };
    const logged = captureErrors();
    try {
      const response = await replace(media.id, 'x.jpg', await image(1500, 2000));
      expect(response.statusCode).toBe(200);
    } finally {
      harness.store.remove = originalRemove;
      logged.restore();
    }
    expect(JSON.stringify(logged.calls)).toContain(media.id);
    expect((await mediaRow(media.id)).width).toBe(1500);
  });

  it('eliminare un media toglie anche le derivate, righe e oggetti', async () => {
    const media = await uploaded(`${unique('eliminata')}.jpg`, await image(800, 600));
    const rows = await variantRows(media.id);
    expect(rows.length).toBeGreaterThan(0);
    const response = await harness.app.inject({
      method: 'DELETE',
      url: `/media/${media.id}`,
      headers: signed.writeHeaders,
    });
    expect(response.statusCode).toBe(204);
    for (const row of rows) {
      expect(harness.store.objects.has(bucketKey(row.storageKey))).toBe(false);
    }
    expect(harness.store.objects.has(bucketKey(media.storageKey))).toBe(false);
  });
});

describe('cache dei file dei media (D149-A)', () => {
  it('Cache-Control: no-cache su 200, 206 e 304; ETag e Last-Modified restano', async () => {
    const media = await uploaded(`${unique('cache')}.jpg`, await image(600, 400));

    const ok = await harness.app.inject({ method: 'GET', url: media.publicPath });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['cache-control']).toBe('no-cache');
    const etag = ok.headers.etag as string;
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(ok.headers['last-modified']).toBeTruthy();

    const notModified = await harness.app.inject({
      method: 'GET',
      url: media.publicPath,
      headers: { 'if-none-match': etag },
    });
    expect(notModified.statusCode).toBe(304);
    expect(notModified.headers['cache-control']).toBe('no-cache');
    expect(notModified.headers.etag).toBe(etag);

    const partial = await harness.app.inject({
      method: 'GET',
      url: media.publicPath,
      headers: { range: 'bytes=0-9' },
    });
    expect(partial.statusCode).toBe(206);
    expect(partial.headers['cache-control']).toBe('no-cache');
  });

  it('dopo una sostituzione il browser che convalida riceve il file nuovo', async () => {
    const media = await uploaded(`${unique('convalida')}.jpg`, await image(600, 400));
    const first = await harness.app.inject({ method: 'GET', url: media.publicPath });
    const oldEtag = first.headers.etag as string;
    await replace(media.id, 'x.jpg', await image(600, 400, { color: { r: 1, g: 200, b: 1 } }));
    const second = await harness.app.inject({
      method: 'GET',
      url: media.publicPath,
      headers: { 'if-none-match': oldEtag },
    });
    expect(second.statusCode).toBe(200);
    expect(second.headers.etag).not.toBe(oldEtag);
  });
});
