import { schema } from '@amoris/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../src/auth/permissions.js';
import { signInWithPermissions } from './_support/contentAddress.js';
import { buildPdf } from './_support/syntheticFiles.js';
import {
  ADMIN_EMAIL,
  createHarness,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W6, T2: documenti scaricabili nell'API (S1-S3, D156). Elenco, dettaglio e
 * modifica dei soli documenti pubblici, `modified_at` e lettura pubblica. Dati sintetici.
 */

let h: Harness;
let signed: Signed;
let impostazioni: Signed;
let sola: Signed;

const PDF = Buffer.from('%PDF-1.4\n% documento sintetico\n%%EOF\n');
// Il file caricato passa dalla pulizia dei metadati: deve essere un PDF vero.
const NUOVO_PDF = buildPdf({ visibleText: 'documento sintetico nuovo' });

let counter = 0;

async function insertMedia(isPrivate: boolean): Promise<string> {
  counter += 1;
  const fileName = `modulo-sintetico-${counter}.pdf`;
  const storageKey = `2026/01/${fileName}`;
  const [row] = await h.db
    .insert(schema.media)
    .values({
      storageKey,
      publicPath: `/media/${storageKey}`,
      fileName,
      mimeType: 'application/pdf',
      byteSize: PDF.byteLength,
      checksum: Buffer.from(fileName.padEnd(32, '0')),
      isPrivate,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media non creato');
  await h.store.put(
    isPrivate ? 'media-private' : 'media-public',
    storageKey,
    PDF,
    'application/pdf',
  );
  return row.id;
}

interface Seed {
  readonly isPrivate?: boolean;
  readonly mediaPrivate?: boolean;
  readonly title?: string;
}

async function newDocument(
  seed: Seed = {},
): Promise<{ id: string; slug: string; mediaId: string }> {
  counter += 1;
  const mediaId = await insertMedia(seed.mediaPrivate ?? false);
  const slug = `documento-${counter}`;
  const [row] = await h.db
    .insert(schema.documents)
    .values({
      slug,
      title: seed.title ?? `Documento ${counter}`,
      description: 'Descrizione iniziale',
      mediaId,
      isPrivate: seed.isPrivate ?? false,
      publishedAt: new Date('2025-05-01T10:00:00Z'),
    })
    .returning({ id: schema.documents.id });
  if (!row) throw new Error('documento non creato');
  return { id: row.id, slug, mediaId };
}

async function rowOf(id: string) {
  const [row] = await h.db.select().from(schema.documents).where(eq(schema.documents.id, id));
  if (!row) throw new Error('documento sparito');
  return row;
}

const get = (url: string, cookie = signed.cookie) =>
  h.app.inject({ method: 'GET', url, headers: { cookie } });

const patch = (id: string, payload: Record<string, unknown>, who: Signed = signed) =>
  h.app.inject({ method: 'PATCH', url: `/documents/${id}`, headers: who.writeHeaders, payload });

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

const replaceFile = (mediaId: string, fileName: string, body: Buffer) => {
  const { payload, headers } = multipart(fileName, body);
  return h.app.inject({ method: 'PUT', url: `/media/${mediaId}/file`, headers, payload });
};

beforeAll(async () => {
  h = await createHarness('api_documents');
  signed = await signIn(h, { area: 'redazione' });
  impostazioni = await signIn(h, { email: ADMIN_EMAIL, area: 'impostazioni' });
  sola = await signInWithPermissions(h, 'solo-lettura', [PERMISSIONS.contentRead]);
}, 180_000);

afterAll(async () => {
  await h?.teardown();
});

describe('elenco e dettaglio (S1)', () => {
  it('GET /documents elenca i soli documenti pubblici, ordinati per titolo', async () => {
    const b = await newDocument({ title: 'Zeta elenco' });
    const a = await newDocument({ title: 'Alfa elenco' });
    const riservato = await newDocument({ isPrivate: true, title: 'Riservato elenco' });
    const fileRiservato = await newDocument({ mediaPrivate: true, title: 'File riservato elenco' });

    const response = await get('/documents');
    expect(response.statusCode, response.body).toBe(200);
    const items = response.json() as { id: string; title: string }[];
    const ids = items.map((item) => item.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(ids).not.toContain(riservato.id);
    expect(ids).not.toContain(fileRiservato.id);
    expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));
    const titles = items.map((item) => item.title);
    expect(titles).toEqual([...titles].sort((x, y) => x.localeCompare(y, 'it')));
  });

  it('GET /documents/:id restituisce la forma dell’area con file e indirizzo sul sito', async () => {
    const doc = await newDocument({ title: 'Dettaglio sintetico' });
    const response = await get(`/documents/${doc.id}`);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      id: doc.id,
      slug: doc.slug,
      title: 'Dettaglio sintetico',
      description: 'Descrizione iniziale',
      publishedAt: '2025-05-01T10:00:00.000Z',
      modifiedAt: null,
      sitePath: `/download/${doc.slug}/`,
      file: {
        mediaId: doc.mediaId,
        fileName: expect.stringMatching(/^modulo-sintetico-\d+\.pdf$/),
        mimeType: 'application/pdf',
        byteSize: PDF.byteLength,
        publicPath: expect.stringMatching(/^\/media\/2026\/01\/modulo-sintetico-\d+\.pdf$/),
      },
    });
  });

  it('un documento riservato, uno con il file riservato e un id inesistente rispondono 404', async () => {
    const riservato = await newDocument({ isPrivate: true });
    const fileRiservato = await newDocument({ mediaPrivate: true });
    for (const id of [riservato.id, fileRiservato.id, '00000000-0000-4000-8000-000000000000']) {
      expect((await get(`/documents/${id}`)).statusCode).toBe(404);
      expect((await patch(id, { title: 'Nuovo' })).statusCode).toBe(404);
    }
    expect((await rowOf(riservato.id)).title).not.toBe('Nuovo');
  });

  it('anonimo 401; sessione Impostazioni 403', async () => {
    const doc = await newDocument();
    for (const url of ['/documents', `/documents/${doc.id}`]) {
      expect((await h.app.inject({ method: 'GET', url })).statusCode).toBe(401);
      expect((await get(url, impostazioni.cookie)).statusCode).toBe(403);
    }
    expect((await patch(doc.id, { title: 'Altro' }, impostazioni)).statusCode).toBe(403);
  });

  it('un id non uuid risponde 400', async () => {
    expect((await get('/documents/non-un-uuid')).statusCode).toBe(400);
  });
});

describe('modifica (S1, D156-A)', () => {
  it('salva titolo e descrizione, scrive modified_at e updated_at e la riga di registro', async () => {
    const doc = await newDocument();
    const before = await rowOf(doc.id);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await patch(doc.id, { title: '  Titolo nuovo  ', description: 'Testo nuovo' });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      id: doc.id,
      title: 'Titolo nuovo',
      description: 'Testo nuovo',
    });
    expect(response.json().modifiedAt).toEqual(expect.any(String));

    const after = await rowOf(doc.id);
    expect(after.title).toBe('Titolo nuovo');
    expect(after.description).toBe('Testo nuovo');
    expect(after.modifiedAt).toBeInstanceOf(Date);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(after.slug).toBe(before.slug);

    const righe = await h.db
      .select()
      .from(schema.auditLog)
      .where(
        and(eq(schema.auditLog.action, 'document.update'), eq(schema.auditLog.entityId, doc.id)),
      );
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ entityType: 'document', outcome: 'success' });
  });

  it('una descrizione vuota o di soli spazi si salva NULL; il solo titolo lascia la descrizione', async () => {
    const doc = await newDocument();
    const solo = await patch(doc.id, { title: 'Solo titolo' });
    expect(solo.statusCode).toBe(200);
    expect((await rowOf(doc.id)).description).toBe('Descrizione iniziale');

    for (const description of ['', '   ', null]) {
      await patch(doc.id, { description: 'Di nuovo qualcosa' });
      const response = await patch(doc.id, { description });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().description).toBeNull();
      expect((await rowOf(doc.id)).description).toBeNull();
    }
  });

  it('titolo vuoto, di soli spazi o oltre 300 caratteri, descrizione oltre 5000, corpo vuoto: 400 e nulla cambia', async () => {
    const doc = await newDocument({ title: 'Invariato' });
    const before = await rowOf(doc.id);
    const cases: Record<string, unknown>[] = [
      { title: '' },
      { title: '    ' },
      { title: 'x'.repeat(301) },
      { description: 'y'.repeat(5001) },
      {},
    ];
    for (const payload of cases) {
      const response = await patch(doc.id, payload);
      expect(response.statusCode, JSON.stringify(payload).slice(0, 40)).toBe(400);
    }
    expect(await rowOf(doc.id)).toEqual(before);
    expect((await patch(doc.id, { title: 'x'.repeat(300) })).statusCode).toBe(200);
  });

  it('i rifiuti per lunghezza dicono in italiano quale campo e quanto', async () => {
    const doc = await newDocument();
    const lungoTitolo = await patch(doc.id, { title: 'x'.repeat(301) });
    expect(lungoTitolo.json().error.details).toEqual([
      expect.objectContaining({
        path: '/title',
        message: 'Il titolo può avere al massimo 300 caratteri.',
      }),
    ]);
    const lungaDescrizione = await patch(doc.id, { description: 'y'.repeat(5001) });
    expect(lungaDescrizione.json().error.details).toEqual([
      expect.objectContaining({
        path: '/description',
        message: 'La descrizione può avere al massimo 5000 caratteri.',
      }),
    ]);
  });

  it('il testo resta testo: con <b> nel titolo si salva alla lettera', async () => {
    const doc = await newDocument();
    const response = await patch(doc.id, { title: 'Modulo <b>grassetto</b>' });
    expect(response.statusCode).toBe(200);
    expect((await rowOf(doc.id)).title).toBe('Modulo <b>grassetto</b>');
  });

  it('serve content.write: chi può solo leggere riceve 403 e nulla cambia', async () => {
    const doc = await newDocument({ title: 'Solo lettura' });
    const before = await rowOf(doc.id);
    expect((await patch(doc.id, { title: 'Cambiato' }, sola)).statusCode).toBe(403);
    expect(await rowOf(doc.id)).toEqual(before);
    expect((await get(`/documents/${doc.id}`, sola.cookie)).statusCode).toBe(200);
  });
});

describe('sostituzione del file e data di modifica (S2, D156)', () => {
  it('PUT /media/:id/file di un PDF citato aggiorna modified_at e updated_at del documento', async () => {
    const doc = await newDocument();
    const altro = await newDocument();
    const before = await rowOf(doc.id);
    const altroBefore = await rowOf(altro.id);
    expect(before.modifiedAt).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await replaceFile(doc.mediaId, 'sostituito.pdf', NUOVO_PDF);
    expect(response.statusCode, response.body).toBe(200);

    const after = await rowOf(doc.id);
    expect(after.modifiedAt).toBeInstanceOf(Date);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(await rowOf(altro.id)).toEqual(altroBefore);
    expect((await get(`/documents/${doc.id}`)).json().modifiedAt).toBe(
      after.modifiedAt?.toISOString(),
    );
  });

  it('se la sostituzione fallisce la data del documento resta com’era', async () => {
    const doc = await newDocument();
    const before = await rowOf(doc.id);
    const originalPut = h.store.put;
    h.store.put = async () => {
      throw new Error('rete interrotta (prova)');
    };
    try {
      const response = await replaceFile(doc.mediaId, 'fallito.pdf', NUOVO_PDF);
      expect(response.statusCode).toBe(500);
    } finally {
      h.store.put = originalPut;
    }
    expect(await rowOf(doc.id)).toEqual(before);
  });

  it('un tipo diverso è rifiutato e la data non cambia', async () => {
    const doc = await newDocument();
    const before = await rowOf(doc.id);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const response = await replaceFile(doc.mediaId, 'immagine.png', png);
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(await rowOf(doc.id)).toEqual(before);
  });
});

describe('lettura pubblica (S4)', () => {
  it('un documento importato ha modifiedAt: null', async () => {
    const doc = await newDocument();
    const response = await h.app.inject({ method: 'GET', url: `/public/documents/${doc.slug}` });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().document.modifiedAt).toBeNull();
  });

  it('dopo la modifica /public/documents/:slug restituisce titolo, descrizione e modifiedAt nuovi', async () => {
    const doc = await newDocument();
    expect(
      (await patch(doc.id, { title: 'Titolo pubblico', description: 'Descr. pubblica' }))
        .statusCode,
    ).toBe(200);
    const response = await h.app.inject({ method: 'GET', url: `/public/documents/${doc.slug}` });
    expect(response.statusCode).toBe(200);
    const body = response.json().document as Record<string, unknown>;
    expect(body).toMatchObject({ title: 'Titolo pubblico', description: 'Descr. pubblica' });
    expect(body.modifiedAt).toBe((await rowOf(doc.id)).modifiedAt?.toISOString());
  });

  it('la lista per categoria porta modifiedAt', async () => {
    const doc = await newDocument();
    const [term] = await h.db
      .insert(schema.terms)
      .values({
        taxonomy: 'wpdmcategory',
        slug: 'categoria-doc',
        name: 'Categoria documenti',
        path: '/download-category/categoria-doc/',
      })
      .returning({ id: schema.terms.id });
    await h.db.insert(schema.documentTerms).values({ documentId: doc.id, termId: term?.id ?? '' });
    const response = await h.app.inject({
      method: 'GET',
      url: `/public/documents?termId=${term?.id}`,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().items[0]).toHaveProperty('modifiedAt', null);
  });
});
