import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Wave 1G-W4, T3: estratto e immagine in evidenza di una notizia (D139 = B, S3).
 * Immagine valida solo se esistente, pubblica e `image/*`; estratto vuoto salvato
 * come `NULL` prima del confronto; dettaglio con `termIds` e `featuredMedia`. Dati sintetici.
 */

let harness: Harness;
let signed: Signed;
let publicImage: string;
let secondImage: string;
let privateImage: string;
let pdf: string;
let categoryId: string;
let counter = 0;

async function newMedia(
  fileName: string,
  values: { mimeType: string; isPrivate?: boolean },
): Promise<string> {
  const [row] = await harness.db
    .insert(schema.media)
    .values({
      storageKey: `2026/01/${fileName}`,
      publicPath: `/media/2026/01/${fileName}`,
      fileName,
      mimeType: values.mimeType,
      byteSize: 4,
      checksum: Buffer.from(fileName.padEnd(32, '0')),
      title: `Titolo ${fileName}`,
      isPrivate: values.isPrivate ?? false,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media di prova non creato');
  return row.id;
}

async function newPost(values: {
  excerpt?: string | null;
  text?: string;
  published?: boolean;
  featuredMediaId?: string | null;
  blocks?: unknown[];
}): Promise<string> {
  counter += 1;
  const published = values.published ?? true;
  const [row] = await harness.db
    .insert(schema.contents)
    .values({
      type: 'post',
      status: published ? 'published' : 'draft',
      slug: `notizia-${counter}`,
      path: `/notizia-${counter}/`,
      title: `Titolo notizia ${counter}`,
      excerpt: values.excerpt ?? null,
      contentText: values.text ?? 'uno due tre quattro cinque sei',
      featuredMediaId: values.featuredMediaId ?? null,
      blocks: { schema: 1, blocks: values.blocks ?? [] },
      publishedAt: published ? new Date('2026-02-01T10:00:00Z') : null,
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('notizia di prova non creata');
  await harness.db.insert(schema.contentTerms).values({ contentId: row.id, termId: categoryId });
  return row.id;
}

beforeAll(async () => {
  harness = await createHarness('api_content_listing');
  signed = await signIn(harness, { area: 'redazione' });
  const [term] = await harness.db
    .insert(schema.terms)
    .values({
      taxonomy: 'category',
      slug: 'cat-sintetica',
      name: 'Cat',
      path: '/category/cat-sintetica/',
    })
    .returning({ id: schema.terms.id });
  if (!term) throw new Error('categoria di prova non creata');
  categoryId = term.id;
  publicImage = await newMedia('pubblica.png', { mimeType: 'image/png' });
  secondImage = await newMedia('seconda.jpg', { mimeType: 'image/jpeg' });
  privateImage = await newMedia('riservata.png', { mimeType: 'image/png', isPrivate: true });
  pdf = await newMedia('documento.pdf', { mimeType: 'application/pdf' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const patch = (id: string, payload: Record<string, unknown>) =>
  harness.app.inject({
    method: 'PATCH',
    url: `/contents/${id}`,
    headers: signed.writeHeaders,
    payload,
  });

const storedRow = async (id: string) => {
  const [row] = await harness.db.select().from(schema.contents).where(eq(schema.contents.id, id));
  return row;
};

interface Err {
  error: { code: string; message: string };
}

describe('featuredMediaId di PATCH /contents/:id (S3)', () => {
  it.each([
    ['inesistente', () => randomUUID()],
    ['privato', () => privateImage],
    ['non immagine', () => pdf],
  ])(
    'un media %s è rifiutato con 400 CONTENT_MEDIA_INVALID e nulla viene scritto',
    async (_nome, pick) => {
      const id = await newPost({});
      const prima = await storedRow(id);
      const risposta = await patch(id, {
        title: 'Titolo che non deve passare',
        featuredMediaId: pick(),
      });
      expect(risposta.statusCode, risposta.body).toBe(400);
      expect((risposta.json() as Err).error.code).toBe('CONTENT_MEDIA_INVALID');
      expect(await storedRow(id)).toEqual(prima);
    },
  );

  it('un’immagine pubblica è accettata e archivio e ricerca la restituiscono', async () => {
    const id = await newPost({ text: 'parola-rara-immagine' });
    const risposta = await patch(id, { featuredMediaId: publicImage });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().featuredMediaId).toBe(publicImage);

    for (const url of [
      `/public/posts?termIds=${categoryId}&perPage=50`,
      '/public/search?s=parola-rara-immagine',
    ]) {
      const pubblica = await harness.app.inject({ method: 'GET', url });
      expect(pubblica.statusCode, pubblica.body).toBe(200);
      const body = pubblica.json() as {
        items: { id: string; featuredMediaId: string | null }[];
        media: Record<string, { publicPath: string }>;
      };
      expect(body.items.find((item) => item.id === id)?.featuredMediaId).toBe(publicImage);
      expect(body.media[publicImage]?.publicPath).toBe('/media/2026/01/pubblica.png');
    }
  });

  it('l’immagine si cambia con un’altra pubblica e null la toglie', async () => {
    const id = await newPost({ featuredMediaId: publicImage });
    expect((await patch(id, { featuredMediaId: secondImage })).json().featuredMediaId).toBe(
      secondImage,
    );
    const tolta = await patch(id, { featuredMediaId: null });
    expect(tolta.statusCode, tolta.body).toBe(200);
    expect(tolta.json().featuredMediaId).toBeNull();
    expect((await storedRow(id))?.featuredMediaId).toBeNull();
  });

  it('eliminare un media usato come immagine in evidenza è rifiutato con 409', async () => {
    const image = await newMedia('in-uso.png', { mimeType: 'image/png' });
    const id = await newPost({ featuredMediaId: image });
    const risposta = await harness.app.inject({
      method: 'DELETE',
      url: `/media/${image}`,
      headers: signed.writeHeaders,
    });
    expect(risposta.statusCode, risposta.body).toBe(409);
    expect(risposta.json().error.message).toContain(`Titolo notizia`);
    const [ancora] = await harness.db.select().from(schema.media).where(eq(schema.media.id, image));
    expect(ancora).toBeDefined();
    expect((await storedRow(id))?.featuredMediaId).toBe(image);
  });
});

describe('estratto di PATCH /contents/:id (D139 = B)', () => {
  it('«» diventa NULL, e blocco «Elenco articoli», archivio e ricerca tornano all’inizio automatico', async () => {
    const id = await newPost({
      excerpt: 'Estratto scritto a mano',
      text: 'alfa beta gamma delta epsilon',
      blocks: [],
    });
    const [list] = await harness.db
      .insert(schema.contents)
      .values({
        type: 'page',
        status: 'published',
        slug: 'con-elenco',
        path: '/con-elenco/',
        title: 'Con elenco',
        blocks: {
          schema: 1,
          blocks: [
            {
              type: 'post_list',
              id: 'bl-estratto',
              props: { termIds: [categoryId], excerptWords: 3, order: 'date_desc' },
            },
          ],
        },
        publishedAt: new Date('2026-02-02T10:00:00Z'),
      })
      .returning({ id: schema.contents.id });
    expect(list).toBeDefined();
    const elenco = async () => {
      const r = await harness.app.inject({
        method: 'GET',
        url: '/public/content?path=/con-elenco/',
      });
      expect(r.statusCode, r.body).toBe(200);
      const items = r.json().postLists['bl-estratto'] as { id: string; summary: string }[];
      return items.find((item) => item.id === id);
    };
    expect((await elenco())?.summary).toBe('Estratto scritto a mano');

    const risposta = await patch(id, { excerpt: '' });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().excerpt).toBeNull();
    expect((await storedRow(id))?.excerpt).toBeNull();

    expect((await elenco())?.summary).toBe('alfa beta gamma');
    for (const url of [`/public/posts?termIds=${categoryId}&perPage=50`, '/public/search?s=alfa']) {
      const r = await harness.app.inject({ method: 'GET', url });
      const item = (
        r.json().items as {
          id: string;
          excerpt: string | null;
          summary: string;
          textStart: string;
        }[]
      ).find((i) => i.id === id);
      expect(item?.excerpt).toBeNull();
      expect(item?.textStart).toBe('alfa beta gamma delta epsilon');
    }
  });

  it('un estratto vuoto invariato (NULL salvato, «» inviato) non cambia data né description', async () => {
    const id = await newPost({ excerpt: null });
    await harness.db
      .update(schema.contents)
      .set({
        descriptionSource: 'Description importata',
        modifiedAt: new Date('2020-05-06T07:08:09Z'),
      })
      .where(eq(schema.contents.id, id));
    const prima = await storedRow(id);
    const risposta = await patch(id, { excerpt: '' });
    expect(risposta.statusCode, risposta.body).toBe(200);
    const dopo = await storedRow(id);
    expect(dopo?.modifiedAt?.getTime()).toBe(prima?.modifiedAt?.getTime());
    expect(dopo?.descriptionSource).toBe('Description importata');
    expect(dopo?.excerpt).toBeNull();
  });

  it('un estratto con testo invariato non cambia data né description', async () => {
    const id = await newPost({ excerpt: 'Estratto fisso' });
    await harness.db
      .update(schema.contents)
      .set({
        descriptionSource: 'Description importata',
        modifiedAt: new Date('2020-05-06T07:08:09Z'),
      })
      .where(eq(schema.contents.id, id));
    const prima = await storedRow(id);
    expect((await patch(id, { excerpt: 'Estratto fisso' })).statusCode).toBe(200);
    const dopo = await storedRow(id);
    expect(dopo?.modifiedAt?.getTime()).toBe(prima?.modifiedAt?.getTime());
    expect(dopo?.descriptionSource).toBe('Description importata');
  });

  it('svuotare un estratto scritto cambia la data e azzera la description', async () => {
    const id = await newPost({ excerpt: 'Da svuotare' });
    await harness.db
      .update(schema.contents)
      .set({
        descriptionSource: 'Description importata',
        modifiedAt: new Date('2020-05-06T07:08:09Z'),
      })
      .where(eq(schema.contents.id, id));
    expect((await patch(id, { excerpt: '' })).statusCode).toBe(200);
    const dopo = await storedRow(id);
    expect(dopo?.excerpt).toBeNull();
    expect(dopo?.descriptionSource).toBeNull();
    expect(dopo?.modifiedAt?.getTime()).toBeGreaterThan(new Date('2020-05-06T07:08:09Z').getTime());
  });
});

describe('GET /contents/:id: termIds e featuredMedia (§5)', () => {
  it('restituisce le categorie e l’immagine in evidenza con la miniatura', async () => {
    const id = await newPost({ featuredMediaId: publicImage });
    const risposta = await harness.app.inject({
      method: 'GET',
      url: `/contents/${id}`,
      headers: { cookie: signed.cookie },
    });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json()).toMatchObject({
      termIds: [categoryId],
      featuredMedia: {
        id: publicImage,
        title: 'Titolo pubblica.png',
        thumbnailUrl: '/media/2026/01/pubblica.png',
      },
    });
  });

  it('senza immagine né categorie: featuredMedia null e termIds vuoto', async () => {
    const id = await newPost({});
    await harness.db.delete(schema.contentTerms).where(eq(schema.contentTerms.contentId, id));
    const risposta = await harness.app.inject({
      method: 'GET',
      url: `/contents/${id}`,
      headers: { cookie: signed.cookie },
    });
    expect(risposta.json()).toMatchObject({ termIds: [], featuredMedia: null });
  });

  it('termIds contiene solo le categorie, non altre tassonomie', async () => {
    const id = await newPost({});
    const [tag] = await harness.db
      .insert(schema.terms)
      .values({
        taxonomy: 'post_tag',
        slug: 'etichetta',
        name: 'Etichetta',
        path: '/tag/etichetta/',
      })
      .returning({ id: schema.terms.id });
    if (!tag) throw new Error('etichetta non creata');
    await harness.db.insert(schema.contentTerms).values({ contentId: id, termId: tag.id });
    const risposta = await harness.app.inject({
      method: 'GET',
      url: `/contents/${id}`,
      headers: { cookie: signed.cookie },
    });
    expect(risposta.json().termIds).toEqual([categoryId]);
  });
});
