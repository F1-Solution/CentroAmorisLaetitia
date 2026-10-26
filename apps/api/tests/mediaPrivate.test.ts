import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Media riservati fuori dall'area (S6) e media citati da documenti e slide (S7),
 * sul database usa e getta. Nessun dato reale: file, titoli e byte sono sintetici.
 */

let h: Harness;
let signed: Signed;
let privateId = '';
let documentMediaId = '';
let slideMediaId = '';

const PRIVATE_KEY = '2026/01/riservato-sintetico.pdf';
const PRIVATE_OBJECT = `media-private/${PRIVATE_KEY}`;
const PRIVATE_BYTES = Buffer.from('%PDF-1.4\n% riservato sintetico\n%%EOF\n');
const DOCUMENT_TITLE = 'Documento sintetico citante';
const SLIDER_TITLE = 'Carosello sintetico citante';

async function insertMedia(fileName: string, isPrivate: boolean): Promise<string> {
  const storageKey = `2026/01/${fileName}`;
  const [row] = await h.db
    .insert(schema.media)
    .values({
      storageKey,
      publicPath: `/media/${storageKey}`,
      fileName,
      mimeType: 'application/pdf',
      byteSize: PRIVATE_BYTES.byteLength,
      checksum: Buffer.from(fileName.padEnd(32, '0')),
      isPrivate,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media non creato');
  await h.store.put(
    isPrivate ? 'media-private' : 'media-public',
    storageKey,
    PRIVATE_BYTES,
    'application/pdf',
  );
  return row.id;
}

function multipart(fileName: string, body: Buffer) {
  const boundary = '----prova-sintetica';
  const head = Buffer.from(
    `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `content-type: application/pdf\r\n\r\n`,
  );
  return {
    payload: Buffer.concat([head, body, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    headers: {
      ...signed.writeHeaders,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
  };
}

beforeAll(async () => {
  h = await createHarness('api_media_private');
  signed = await signIn(h, { area: 'redazione' });
  privateId = await insertMedia('riservato-sintetico.pdf', true);
  documentMediaId = await insertMedia('documento-citato.pdf', false);
  slideMediaId = await insertMedia('slide-citata.pdf', false);
  await h.db.insert(schema.documents).values({
    slug: 'documento-sintetico',
    title: DOCUMENT_TITLE,
    mediaId: documentMediaId,
  });
  const [slider] = await h.db
    .insert(schema.sliders)
    .values({ key: 'sintetico', title: SLIDER_TITLE })
    .returning({ id: schema.sliders.id });
  await h.db
    .insert(schema.sliderSlides)
    .values({ sliderId: slider?.id ?? '', position: 1, mediaId: slideMediaId });
}, 180_000);

afterAll(async () => {
  await h?.teardown();
});

const get = (url: string) =>
  h.app.inject({ method: 'GET', url, headers: { cookie: signed.cookie } });

describe('media riservati (S6)', () => {
  it('GET /media non elenca un media riservato', async () => {
    const response = await get('/media?perPage=100');
    expect(response.statusCode).toBe(200);
    const ids = (response.json() as { items: { id: string }[] }).items.map((item) => item.id);
    expect(ids).not.toContain(privateId);
    expect(ids).toContain(documentMediaId);
  });

  it('GET, PATCH, PUT /file e DELETE rispondono 404 e non scrivono nulla', async () => {
    const missing = await get('/media/00000000-0000-4000-8000-000000000000');
    expect(missing.statusCode).toBe(404);
    const before = h.store.objects.get(PRIVATE_OBJECT);
    const [rowBefore] = await h.db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, privateId));

    const read = await get(`/media/${privateId}`);
    const patch = await h.app.inject({
      method: 'PATCH',
      url: `/media/${privateId}`,
      headers: signed.writeHeaders,
      payload: { title: 'Titolo cambiato' },
    });
    const { payload, headers } = multipart(
      'riservato-sintetico.pdf',
      Buffer.from('%PDF-1.4\n%x\n%%EOF\n'),
    );
    const put = await h.app.inject({
      method: 'PUT',
      url: `/media/${privateId}/file`,
      headers,
      payload,
    });
    const del = await h.app.inject({
      method: 'DELETE',
      url: `/media/${privateId}`,
      headers: signed.writeHeaders,
    });

    for (const response of [read, patch, put, del]) {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe(missing.json().error.code);
    }
    expect(h.store.objects.get(PRIVATE_OBJECT)?.equals(before ?? Buffer.alloc(0))).toBe(true);
    expect(h.store.objects.get(PRIVATE_OBJECT)?.equals(PRIVATE_BYTES)).toBe(true);
    const [rowAfter] = await h.db.select().from(schema.media).where(eq(schema.media.id, privateId));
    expect(rowAfter).toEqual(rowBefore);
  });
});

describe('media citati da documenti e slide (S7)', () => {
  it('il media di un documento non si elimina: 409 con il titolo, nulla cambia', async () => {
    const response = await h.app.inject({
      method: 'DELETE',
      url: `/media/${documentMediaId}`,
      headers: signed.writeHeaders,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MEDIA_IN_USE');
    expect(response.json().error.message).toContain(DOCUMENT_TITLE);
    const rows = await h.db.select().from(schema.media).where(eq(schema.media.id, documentMediaId));
    expect(rows).toHaveLength(1);
    expect(h.store.objects.has('media-public/2026/01/documento-citato.pdf')).toBe(true);
  });

  it('se lo cita un documento riservato il 409 dice «un documento riservato», mai il titolo', async () => {
    const mediaId = await insertMedia('citato-da-riservato.pdf', false);
    const riservato = 'Verbale riservato sintetico';
    await h.db.insert(schema.documents).values({
      slug: 'documento-riservato-sintetico',
      title: riservato,
      mediaId,
      isPrivate: true,
    });
    const response = await h.app.inject({
      method: 'DELETE',
      url: `/media/${mediaId}`,
      headers: signed.writeHeaders,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MEDIA_IN_USE');
    expect(response.json().error.message).toContain('un documento riservato');
    expect(response.body).not.toContain(riservato);
    const rows = await h.db.select().from(schema.media).where(eq(schema.media.id, mediaId));
    expect(rows).toHaveLength(1);
    expect(h.store.objects.has('media-public/2026/01/citato-da-riservato.pdf')).toBe(true);
  });

  it('il media di una slide non si elimina: 409 con il titolo del carosello, la slide resta', async () => {
    const response = await h.app.inject({
      method: 'DELETE',
      url: `/media/${slideMediaId}`,
      headers: signed.writeHeaders,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('MEDIA_IN_USE');
    expect(response.json().error.message).toContain(SLIDER_TITLE);
    const slides = await h.db
      .select()
      .from(schema.sliderSlides)
      .where(eq(schema.sliderSlides.mediaId, slideMediaId));
    expect(slides).toHaveLength(1);
    expect(h.store.objects.has('media-public/2026/01/slide-citata.pdf')).toBe(true);
  });
});

describe('ricerca (S8)', () => {
  it('non restituisce un documento pubblico il cui media è riservato', async () => {
    const ownPrivateId = await insertMedia('riservato-della-ricerca.pdf', true);
    await h.db.insert(schema.documents).values({
      slug: 'modulo-con-media-riservato',
      title: 'Modulo ricercabile sintetico',
      mediaId: ownPrivateId,
      isPrivate: false,
    });
    await h.db.insert(schema.documents).values({
      slug: 'modulo-con-media-pubblico',
      title: 'Modulo ricercabile pubblico',
      mediaId: documentMediaId,
      isPrivate: false,
    });
    const response = await h.app.inject({ method: 'GET', url: '/public/search?s=ricercabile' });
    expect(response.statusCode).toBe(200);
    const paths = (response.json() as { items: { path: string }[] }).items.map((i) => i.path);
    expect(paths).toContain('/download/modulo-con-media-pubblico/');
    expect(paths).not.toContain('/download/modulo-con-media-riservato/');
  });
});
