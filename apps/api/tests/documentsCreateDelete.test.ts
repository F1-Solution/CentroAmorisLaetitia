import { schema } from '@amoris/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../src/auth/permissions.js';
import { inRace, signInWithPermissions } from './_support/contentAddress.js';
import { buildPdf } from './_support/syntheticFiles.js';
import {
  ADMIN_EMAIL,
  createHarness,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W7, T2h (DR-281): creare ed eliminare un documento scaricabile pubblico.
 *
 * - Creazione: il PDF passa da `POST /media` (stesse regole e stessa pulizia dei
 *   caricamenti di oggi), poi `POST /documents` lega titolo, descrizione facoltativa,
 *   categoria dei download e file. Lo slug nasce dal titolo con la regola di WordPress
 *   (vedi `documentSlug.test.ts`), unico anche rispetto ai riservati, ai nomi dei feed e
 *   alle sorgenti dei redirect. Il sito lo vede come un importato.
 * - Eliminazione: rifiutata se un blocco «Documento» o una voce di menu lo cita; poi la
 *   scheda e il file rispondono 404, e il file sparisce solo se nessun altro lo usa.
 * - I riservati non si creano, non si vedono e non si eliminano da qui.
 *
 * Titoli, file e voci di menu sono inventati.
 */

let h: Harness;
let signed: Signed;
let impostazioni: Signed;
let sola: Signed;
let soloContenuti: Signed;
let soloMedia: Signed;
let senzaPubblicare: Signed;
let categoriaId: string;
let altraCategoriaId: string;
let notizieId: string;

const PDF = buildPdf({ visibleText: 'documento sintetico creato' });
let counter = 0;

function multipart(fileName: string, body: Buffer, mime: string, who: Signed) {
  const boundary = '----prova-sintetica';
  const head = Buffer.from(
    `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `content-type: ${mime}\r\n\r\n`,
  );
  return {
    payload: Buffer.concat([head, body, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    headers: { ...who.writeHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/** Carica un PDF con la rotta di oggi e restituisce l'id del media. */
async function uploadPdf(fileName = `modulo-creato-${++counter}.pdf`): Promise<string> {
  const { payload, headers } = multipart(fileName, PDF, 'application/pdf', signed);
  const response = await h.app.inject({ method: 'POST', url: '/media', headers, payload });
  expect(response.statusCode, response.body).toBe(201);
  return (response.json() as { id: string }).id;
}

async function insertMedia(options: { isPrivate?: boolean; mime?: string } = {}) {
  counter += 1;
  const mime = options.mime ?? 'application/pdf';
  const fileName = `inserito-${counter}.${mime === 'application/pdf' ? 'pdf' : 'png'}`;
  const storageKey = `2026/02/${fileName}`;
  const [row] = await h.db
    .insert(schema.media)
    .values({
      storageKey,
      publicPath: `/media/${storageKey}`,
      fileName,
      mimeType: mime,
      byteSize: 10,
      checksum: Buffer.from(fileName.padEnd(32, '0')),
      isPrivate: options.isPrivate ?? false,
      uploadedAt: new Date('2026-02-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media non creato');
  return row.id;
}

const create = (payload: Record<string, unknown>, who: Signed = signed) =>
  h.app.inject({ method: 'POST', url: '/documents', headers: who.writeHeaders, payload });

const remove = (id: string, who: Signed = signed) =>
  h.app.inject({ method: 'DELETE', url: `/documents/${id}`, headers: who.writeHeaders });

const get = (url: string, cookie = signed.cookie) =>
  h.app.inject({ method: 'GET', url, headers: { cookie } });

const publicGet = (url: string) => h.app.inject({ method: 'GET', url });

interface Created {
  id: string;
  slug: string;
  mediaId: string;
  title: string;
}

/** Crea un documento dalla rotta nuova, con un PDF appena caricato. */
async function createDocument(title: string, extra: Record<string, unknown> = {}) {
  const mediaId = (extra.mediaId as string | undefined) ?? (await uploadPdf());
  const response = await create({ title, termId: categoriaId, mediaId, ...extra });
  expect(response.statusCode, response.body).toBe(201);
  return { ...(response.json() as Created), mediaId };
}

async function documentCount(): Promise<number> {
  return (await h.db.select({ id: schema.documents.id }).from(schema.documents)).length;
}

async function insertDocument(slug: string, isPrivate: boolean, mediaId?: string) {
  const [row] = await h.db
    .insert(schema.documents)
    .values({
      slug,
      title: `Inserito ${slug}`,
      mediaId: mediaId ?? (await insertMedia({ isPrivate })),
      isPrivate,
      publishedAt: new Date('2025-01-01T00:00:00Z'),
    })
    .returning({ id: schema.documents.id });
  if (!row) throw new Error('documento non inserito');
  return row.id;
}

async function pageWithDocumentBlock(documentId: string, slug: string) {
  const [row] = await h.db
    .insert(schema.contents)
    .values({
      type: 'page',
      status: 'published',
      slug,
      path: `/${slug}/`,
      title: `Pagina ${slug}`,
      blocks: {
        schema: 1,
        blocks: [
          {
            type: 'document',
            id: `b-${slug}`,
            props: { documentId, label: null, display: 'link', classes: [] },
            children: [],
          },
        ],
      },
      publishedAt: new Date('2026-02-01T10:00:00Z'),
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('pagina non creata');
  return row.id;
}

let menuId: string;

async function menuItem(url: string, label: string) {
  const [row] = await h.db
    .insert(schema.menuItems)
    .values({ menuId, kind: 'custom', label, url })
    .returning({ id: schema.menuItems.id });
  if (!row) throw new Error('voce non creata');
  return row.id;
}

beforeAll(async () => {
  h = await createHarness('api_documents_create');
  signed = await signIn(h, { area: 'redazione' });
  impostazioni = await signIn(h, { email: ADMIN_EMAIL, area: 'impostazioni' });
  sola = await signInWithPermissions(h, 'doc-sola-lettura', [PERMISSIONS.contentRead]);
  soloContenuti = await signInWithPermissions(h, 'doc-solo-contenuti', [
    PERMISSIONS.contentRead,
    PERMISSIONS.contentWrite,
  ]);
  soloMedia = await signInWithPermissions(h, 'doc-solo-media', [
    PERMISSIONS.contentRead,
    PERMISSIONS.mediaWrite,
  ]);
  // Giro 1: scrive contenuti e file, ma non pubblica né ritira (DR-242, DR-246).
  senzaPubblicare = await signInWithPermissions(h, 'doc-senza-pubblicare', [
    PERMISSIONS.contentRead,
    PERMISSIONS.contentWrite,
    PERMISSIONS.mediaWrite,
  ]);
  const terms = await h.db
    .insert(schema.terms)
    .values([
      {
        taxonomy: 'wpdmcategory',
        slug: 'moduli-sintetici',
        name: 'Moduli sintetici',
        path: '/download-category/moduli-sintetici/',
      },
      {
        taxonomy: 'wpdmcategory',
        slug: 'altri-moduli',
        name: 'Altri moduli',
        path: '/download-category/altri-moduli/',
      },
      { taxonomy: 'category', slug: 'notizie-sintetiche', name: 'Notizie', path: '/category/n/' },
    ])
    .returning({ id: schema.terms.id });
  categoriaId = terms[0]?.id ?? '';
  altraCategoriaId = terms[1]?.id ?? '';
  notizieId = terms[2]?.id ?? '';
  const [menu] = await h.db
    .insert(schema.menus)
    .values({ key: 'principale', label: 'Principale' })
    .returning({ id: schema.menus.id });
  menuId = menu?.id ?? '';
}, 180_000);

afterAll(async () => {
  await h?.teardown();
});

describe('creazione (DR-281)', () => {
  it('crea un documento pubblico con slug dal titolo, data di creazione ora, modifica vuota e categoria', async () => {
    const mediaId = await uploadPdf();
    const before = Date.now();
    const response = await create({
      title: '  Modulo d’iscrizione 2026  ',
      description: 'Descrizione sintetica',
      termId: categoriaId,
      mediaId,
    });
    expect(response.statusCode, response.body).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      slug: 'modulo-discrizione-2026',
      title: 'Modulo d’iscrizione 2026',
      description: 'Descrizione sintetica',
      modifiedAt: null,
      sitePath: '/download/modulo-discrizione-2026/',
      file: { mediaId, mimeType: 'application/pdf' },
    });
    expect(new Date(body.publishedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(new Date(body.publishedAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    const [row] = await h.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, body.id));
    expect(row).toMatchObject({
      isPrivate: false,
      modifiedAt: null,
      legacyId: null,
      legacySource: null,
      downloadCount: 0,
    });
    const legami = await h.db
      .select()
      .from(schema.documentTerms)
      .where(eq(schema.documentTerms.documentId, body.id));
    expect(legami).toEqual([{ documentId: body.id, termId: categoriaId }]);

    const righe = await h.db
      .select()
      .from(schema.auditLog)
      .where(
        and(eq(schema.auditLog.action, 'document.create'), eq(schema.auditLog.entityId, body.id)),
      );
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ entityType: 'document', outcome: 'success' });

    // Compare in elenco e dettaglio dell'area.
    expect((await get(`/documents/${body.id}`)).statusCode).toBe(200);
    const elenco = (await get('/documents')).json() as { id: string }[];
    expect(elenco.map((voce) => voce.id)).toContain(body.id);
  });

  it('il sito lo legge come un importato: scheda, elenco della categoria e sitemap', async () => {
    const doc = await createDocument('Documento per il sito', { description: null });
    const scheda = await publicGet(`/public/documents/${doc.slug}`);
    expect(scheda.statusCode, scheda.body).toBe(200);
    expect(scheda.json().document).toMatchObject({
      title: 'Documento per il sito',
      description: null,
      modifiedAt: null,
    });
    expect(scheda.json().terms).toEqual([
      expect.objectContaining({ id: categoriaId, path: '/download-category/moduli-sintetici/' }),
    ]);

    const categoria = await publicGet(`/public/documents?termId=${categoriaId}`);
    expect(categoria.statusCode).toBe(200);
    const slugs = (categoria.json().items as { slug: string }[]).map((item) => item.slug);
    expect(slugs).toContain(doc.slug);

    const sitemap = (await publicGet('/public/sitemap')).json() as {
      entries: { path: string }[];
    };
    const paths = sitemap.entries.map((entry) => entry.path);
    expect(paths).toContain(`/download/${doc.slug}/`);
    expect(paths).toContain('/download-category/moduli-sintetici/');
  });

  it('una descrizione vuota o di soli spazi si salva NULL', async () => {
    const doc = await createDocument('Senza descrizione', { description: '   ' });
    const [row] = await h.db
      .select({ description: schema.documents.description })
      .from(schema.documents)
      .where(eq(schema.documents.id, doc.id));
    expect(row?.description).toBeNull();
  });

  it('lo slug è unico: doppione, slug di un riservato, nome di feed e sorgente di un redirect ricevono il suffisso', async () => {
    const primo = await createDocument('Modulo ripetuto');
    const secondo = await createDocument('Modulo ripetuto');
    expect(primo.slug).toBe('modulo-ripetuto');
    expect(secondo.slug).toBe('modulo-ripetuto-2');

    await insertDocument('modulo-riservato-sintetico', true);
    expect((await createDocument('Modulo riservato sintetico')).slug).toBe(
      'modulo-riservato-sintetico-2',
    );

    expect((await createDocument('Feed')).slug).toBe('feed-2');

    await h.db.insert(schema.redirects).values({
      sourcePath: '/download/modulo-reindirizzato/',
      targetPath: '/altrove/',
      statusCode: 301,
    });
    expect((await createDocument('Modulo reindirizzato')).slug).toBe('modulo-reindirizzato-2');
  });

  it('titolo vuoto o troppo lungo, descrizione troppo lunga, campi mancanti: 400 e nulla nasce', async () => {
    const mediaId = await uploadPdf();
    const before = await documentCount();
    const base = { title: 'Valido', termId: categoriaId, mediaId };
    const cases: Record<string, unknown>[] = [
      { ...base, title: '' },
      { ...base, title: '   ' },
      { ...base, title: 'x'.repeat(301) },
      { ...base, description: 'y'.repeat(5001) },
      { title: 'Valido', mediaId },
      { title: 'Valido', termId: categoriaId },
      { ...base, termId: 'non-un-uuid' },
      { ...base, isPrivate: true },
    ];
    for (const payload of cases) {
      const response = await create(payload);
      expect(response.statusCode, JSON.stringify(payload).slice(0, 60)).toBe(400);
    }
    expect(await documentCount()).toBe(before);
    const lungo = await create({ ...base, title: 'x'.repeat(301) });
    expect(lungo.json().error.details).toEqual([
      expect.objectContaining({
        path: '/title',
        message: 'Il titolo può avere al massimo 300 caratteri.',
      }),
    ]);
  });

  it('la categoria deve essere una categoria dei download esistente', async () => {
    const mediaId = await uploadPdf();
    const before = await documentCount();
    for (const termId of [notizieId, '00000000-0000-4000-8000-000000000000']) {
      const response = await create({ title: 'Categoria errata', termId, mediaId });
      expect(response.statusCode, response.body).toBe(400);
      expect(response.json().error).toMatchObject({
        code: 'DOCUMENT_CATEGORY_INVALID',
        message: 'Scegli una categoria dei download fra quelle esistenti.',
      });
    }
    expect(await documentCount()).toBe(before);
  });

  it('il file deve essere un PDF pubblico della libreria: immagine, riservato o inesistente 400', async () => {
    const before = await documentCount();
    const candidates = [
      await insertMedia({ mime: 'image/png' }),
      await insertMedia({ isPrivate: true }),
      '00000000-0000-4000-8000-000000000000',
    ];
    for (const mediaId of candidates) {
      const response = await create({ title: 'File errato', termId: categoriaId, mediaId });
      expect(response.statusCode, response.body).toBe(400);
      expect(response.json().error).toMatchObject({
        code: 'DOCUMENT_FILE_INVALID',
        message: 'Il file del documento deve essere un PDF caricato nella libreria.',
      });
    }
    expect(await documentCount()).toBe(before);
  });

  it('servono content.write, media.write e content.publish: anonimo 401, gli altri 403 e nulla nasce', async () => {
    const mediaId = await uploadPdf();
    const before = await documentCount();
    const payload = { title: 'Senza permesso', termId: categoriaId, mediaId };
    expect(
      (await h.app.inject({ method: 'POST', url: '/documents', payload })).statusCode,
    ).toBeGreaterThanOrEqual(401);
    for (const who of [sola, soloContenuti, soloMedia, senzaPubblicare, impostazioni]) {
      expect((await create(payload, who)).statusCode).toBe(403);
    }
    // Il rifiuto non dice quale permesso manchi.
    expect((await create(payload, senzaPubblicare)).json().error).toMatchObject({
      code: 'NOT_AUTHORIZED',
      message: 'Operazione non consentita.',
    });
    expect(await documentCount()).toBe(before);
  });

  it('un file già legato a un documento, anche riservato, è rifiutato con 409 e lo stesso messaggio', async () => {
    const primo = await createDocument('Primo con il file');
    const condivisoConRiservato = await insertMedia();
    await insertDocument('riservato-con-file-pubblico', true, condivisoConRiservato);
    const before = await documentCount();
    for (const mediaId of [primo.mediaId, condivisoConRiservato]) {
      const response = await create({ title: 'Riuso del file', termId: categoriaId, mediaId });
      expect(response.statusCode, response.body).toBe(409);
      expect(response.json().error).toEqual(
        expect.objectContaining({
          code: 'DOCUMENT_FILE_IN_USE',
          message: 'Questo file è già il file di un altro documento: caricane uno nuovo.',
        }),
      );
      expect(response.body).not.toMatch(/riservat/i);
    }
    expect(await documentCount()).toBe(before);
  });

  it('due creazioni simultanee con lo stesso file: una riesce, l’altra riceve 409', async () => {
    const mediaId = await uploadPdf();
    const [a, b] = await Promise.all([
      create({ title: 'Simultaneo A', termId: categoriaId, mediaId }),
      create({ title: 'Simultaneo B', termId: categoriaId, mediaId }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    const legati = await h.db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(eq(schema.documents.mediaId, mediaId));
    expect(legati).toHaveLength(1);
  });

  it('M1: il media eliminato mentre la creazione attende il suo blocco dà 400 in italiano, non 500', async () => {
    const mediaId = await insertMedia();
    const before = await documentCount();
    const response = await inRace(
      h,
      (tx) => tx.delete(schema.media).where(eq(schema.media.id, mediaId)),
      () => create({ title: 'Media sparito', termId: categoriaId, mediaId }),
    );
    expect(response.statusCode, response.body).toBe(400);
    expect(response.json().error).toMatchObject({
      code: 'DOCUMENT_FILE_INVALID',
      message: 'Il file del documento deve essere un PDF caricato nella libreria.',
    });
    expect(await documentCount()).toBe(before);
  });

  it('M1: la categoria eliminata mentre la creazione attende dà 400 in italiano, non 500', async () => {
    const mediaId = await insertMedia();
    const [term] = await h.db
      .insert(schema.terms)
      .values({
        taxonomy: 'wpdmcategory',
        slug: 'categoria-che-sparisce',
        name: 'Categoria che sparisce',
        path: '/download-category/categoria-che-sparisce/',
      })
      .returning({ id: schema.terms.id });
    const before = await documentCount();
    const response = await inRace(
      h,
      (tx) => tx.delete(schema.terms).where(eq(schema.terms.id, term?.id ?? '')),
      () => create({ title: 'Categoria sparita', termId: term?.id ?? '', mediaId }),
    );
    expect(response.statusCode, response.body).toBe(400);
    expect(response.json().error.code).toBe('DOCUMENT_CATEGORY_INVALID');
    expect(await documentCount()).toBe(before);
  });
});

describe('anteprima dell’eliminazione', () => {
  it('un documento libero non è trattenuto; elenca i redirect che vi puntano e dice se il file resta', async () => {
    const doc = await createDocument('Anteprima libera');
    await h.db.insert(schema.redirects).values({
      sourcePath: '/vecchio-modulo-anteprima/',
      targetPath: `/download/${doc.slug}/`,
      statusCode: 301,
    });
    const response = await get(`/documents/${doc.id}/deletion`);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      blocked: false,
      contents: [],
      menuItems: [],
      redirectsToPath: [{ source: '/vecchio-modulo-anteprima/' }],
      fileShared: false,
    });
  });

  it('un riservato, uno con il file riservato e un inesistente rispondono 404', async () => {
    const riservato = await insertDocument('riservato-anteprima', true);
    const fileRiservato = await insertDocument(
      'file-riservato-anteprima',
      false,
      await insertMedia({ isPrivate: true }),
    );
    for (const id of [riservato, fileRiservato, '00000000-0000-4000-8000-000000000000']) {
      expect((await get(`/documents/${id}/deletion`)).statusCode).toBe(404);
    }
  });
});

describe('eliminazione (DR-281)', () => {
  it('elimina documento, legami, media e file; scheda e file rispondono 404; registro con titolo e slug', async () => {
    const doc = await createDocument('Da eliminare');
    const [media] = await h.db
      .select({ storageKey: schema.media.storageKey, publicPath: schema.media.publicPath })
      .from(schema.media)
      .where(eq(schema.media.id, doc.mediaId));
    expect(h.store.objects.has(`media-public/${media?.storageKey}`)).toBe(true);
    expect((await publicGet(media?.publicPath ?? '')).statusCode).toBe(200);
    const redirectsPrima = (await h.db.select().from(schema.redirects)).length;

    const response = await remove(doc.id);
    expect(response.statusCode, response.body).toBe(204);

    expect((await get(`/documents/${doc.id}`)).statusCode).toBe(404);
    expect((await publicGet(`/public/documents/${doc.slug}`)).statusCode).toBe(404);
    expect((await publicGet(media?.publicPath ?? '')).statusCode).toBe(404);
    expect(h.store.objects.has(`media-public/${media?.storageKey}`)).toBe(false);
    expect(await h.db.select().from(schema.media).where(eq(schema.media.id, doc.mediaId))).toEqual(
      [],
    );
    expect(
      await h.db
        .select()
        .from(schema.documentTerms)
        .where(eq(schema.documentTerms.documentId, doc.id)),
    ).toEqual([]);
    const sitemap = (await publicGet('/public/sitemap')).json() as { entries: { path: string }[] };
    expect(sitemap.entries.map((entry) => entry.path)).not.toContain(`/download/${doc.slug}/`);

    // Nessun redirect automatico.
    expect((await h.db.select().from(schema.redirects)).length).toBe(redirectsPrima);

    const righe = await h.db
      .select()
      .from(schema.auditLog)
      .where(
        and(eq(schema.auditLog.action, 'document.delete'), eq(schema.auditLog.entityId, doc.id)),
      );
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({
      entityType: 'document',
      outcome: 'success',
      detail: { title: 'Da eliminare', slug: doc.slug },
    });
  });

  it('il file usato anche da un altro documento (dati importati) resta, con il media', async () => {
    const primo = await createDocument('File condiviso uno');
    // Dall'area non si condivide più un file (giro 1): la condivisione si prepara a database.
    const secondo = { id: await insertDocument('file-condiviso-due', false, primo.mediaId) };
    expect((await get(`/documents/${primo.id}/deletion`)).json().fileShared).toBe(true);

    expect((await remove(primo.id)).statusCode).toBe(204);
    const [media] = await h.db
      .select({ storageKey: schema.media.storageKey })
      .from(schema.media)
      .where(eq(schema.media.id, primo.mediaId));
    expect(media).toBeDefined();
    expect(h.store.objects.has(`media-public/${media?.storageKey}`)).toBe(true);
    expect((await get(`/documents/${secondo.id}`)).statusCode).toBe(200);
  });

  it('il file citato da una pagina resta, con il media', async () => {
    const doc = await createDocument('File citato da una pagina');
    const [media] = await h.db
      .select({ storageKey: schema.media.storageKey, publicPath: schema.media.publicPath })
      .from(schema.media)
      .where(eq(schema.media.id, doc.mediaId));
    await h.db.insert(schema.contents).values({
      type: 'page',
      status: 'published',
      slug: 'pagina-con-link-al-pdf',
      path: '/pagina-con-link-al-pdf/',
      title: 'Pagina con collegamento',
      blocks: {
        schema: 1,
        blocks: [
          {
            type: 'html',
            id: 'b-link',
            props: { html: `<a href="${media?.publicPath}">pdf</a>` },
            children: [],
          },
        ],
      },
      publishedAt: new Date('2026-02-01T10:00:00Z'),
    });
    expect((await get(`/documents/${doc.id}/deletion`)).json()).toMatchObject({
      blocked: false,
      fileShared: true,
    });
    expect((await remove(doc.id)).statusCode).toBe(204);
    expect(h.store.objects.has(`media-public/${media?.storageKey}`)).toBe(true);
  });

  it('citato da un blocco «Documento»: anteprima trattenuta, 409 in italiano e nulla cambia', async () => {
    const doc = await createDocument('Citato da un blocco');
    const pagina = await pageWithDocumentBlock(doc.id, 'pagina-col-documento');
    const preview = (await get(`/documents/${doc.id}/deletion`)).json();
    expect(preview).toMatchObject({
      blocked: true,
      contents: [
        { id: pagina, title: 'Pagina pagina-col-documento', path: '/pagina-col-documento/' },
      ],
    });

    const response = await remove(doc.id);
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({
      code: 'DOCUMENT_IN_USE',
      message:
        'Il documento è citato da un blocco «Documento» in: «Pagina pagina-col-documento». Togli prima il blocco.',
    });
    expect((await get(`/documents/${doc.id}`)).statusCode).toBe(200);
  });

  it('citato da una voce di menu, relativa o assoluta: 409; un indirizzo solo simile non trattiene', async () => {
    const doc = await createDocument('Citato da un menu');
    const simile = await createDocument('Citato da un menu altro');
    await menuItem(`/download/${doc.slug}/`, 'Voce relativa');
    await menuItem(`https://www.esempio.invalid/download/${doc.slug}/?x=1`, 'Voce assoluta');
    await menuItem(`/download/${doc.slug}-altro/`, 'Voce simile');

    const preview = (await get(`/documents/${doc.id}/deletion`)).json();
    expect(preview.blocked).toBe(true);
    expect(preview.menuItems.map((item: { label: string }) => item.label).sort()).toEqual([
      'Voce assoluta',
      'Voce relativa',
    ]);
    const response = await remove(doc.id);
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('DOCUMENT_IN_MENU');
    expect(response.json().error.message).toMatch(
      /^Il documento è in un menu: «Voce (assoluta|relativa)» \(menu «Principale»\)/,
    );
    expect((await get(`/documents/${doc.id}`)).statusCode).toBe(200);

    // La voce «simile» è l'indirizzo dell'altro documento: trattiene quello, non questo.
    expect(simile.slug).toBe(`${doc.slug}-altro`);
    expect((await get(`/documents/${simile.id}/deletion`)).json().blocked).toBe(true);
  });

  it('un riservato, uno con il file riservato e un inesistente: 404 e nulla cambia', async () => {
    const riservato = await insertDocument('riservato-eliminazione', true);
    const fileRiservato = await insertDocument(
      'file-riservato-eliminazione',
      false,
      await insertMedia({ isPrivate: true }),
    );
    for (const id of [riservato, fileRiservato, '00000000-0000-4000-8000-000000000000']) {
      expect((await remove(id)).statusCode).toBe(404);
    }
    const rimasti = await h.db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(eq(schema.documents.id, riservato));
    expect(rimasti).toHaveLength(1);
  });

  it('servono content.write, media.write e content.publish: anonimo 401, gli altri 403 e il documento resta', async () => {
    const doc = await createDocument('Eliminazione negata');
    expect(
      (await h.app.inject({ method: 'DELETE', url: `/documents/${doc.id}` })).statusCode,
    ).toBeGreaterThanOrEqual(401);
    for (const who of [sola, soloContenuti, soloMedia, senzaPubblicare, impostazioni]) {
      expect((await remove(doc.id, who)).statusCode).toBe(403);
    }
    expect((await remove(doc.id, senzaPubblicare)).json().error.message).toBe(
      'Operazione non consentita.',
    );
    // L'anteprima non scrive: basta content.read.
    expect((await get(`/documents/${doc.id}/deletion`, sola.cookie)).statusCode).toBe(200);
    expect((await get(`/documents/${doc.id}`)).statusCode).toBe(200);
  });

  it('cambiare categoria non è previsto: un’altra categoria dei download si sceglie solo alla creazione', async () => {
    const doc = await createDocument('In altra categoria', { termId: altraCategoriaId });
    const scheda = await publicGet(`/public/documents/${doc.slug}`);
    expect(scheda.json().terms).toEqual([expect.objectContaining({ id: altraCategoriaId })]);
  });
});
