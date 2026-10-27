import { schema } from '@amoris/db';
import { and, desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * DR-279 (wave 1G-W7, T2f): i blocchi «Video», «Mappa» e «Documento» si configurano
 * dall'editor. Qui la parte dell'API, che è l'ultima difesa: l'editor valida già, ma
 * nessun indirizzo scelto da chi scrive deve arrivare al sito (e a un iframe) senza che
 * l'API lo abbia controllato.
 *
 * - Video: solo YouTube in forma canonica (`https://www.youtube.com/watch?v=…`), oppure
 *   un MP4 **pubblico** della libreria; anteprima facoltativa, solo un'immagine pubblica.
 * - Mappa: coordinate e zoom dallo schema condiviso; il campo `html` dei segnaposto non
 *   si modifica (HTML libero: rischio XSS), si conserva com'è.
 * - Documento: solo un documento pubblico (DR-218, ADR-004 §3.6), mai uno riservato.
 * - Un blocco che non cambia non si rivaluta: i blocchi importati restano salvabili così
 *   come sono (andata e ritorno 1D-36).
 *
 * Valgono per `POST /contents`, `PATCH /contents/:id` e per la copia di lavoro
 * (`PUT /contents/:id/draft`), che l'anteprima rende.
 *
 * Dati sintetici.
 */

let harness: Harness;
let signed: Signed;
let counter = 0;

const YOUTUBE = 'https://www.youtube.com/watch?v=aBcDeFgHi_-';
const VIDEO_PUBLIC = '/media/2026/01/video-sintetico.mp4';
const VIDEO_PRIVATE = '/media/2026/01/video-riservato.mp4';
const WEBM_PUBLIC = '/media/2026/01/video-sintetico.webm';
const IMAGE_PUBLIC = '/media/2026/01/anteprima-sintetica.png';
const IMAGE_PRIVATE = '/media/2026/01/anteprima-riservata.png';
let imagePublicId = '';
let imagePrivateId = '';
let documentPublic = '';
let documentPrivate = '';
let documentPrivateFile = '';

function blockId(): string {
  counter += 1;
  return `b_${counter.toString(16).padStart(12, '0')}`;
}

function video(props: Record<string, unknown>, id = blockId()) {
  return {
    type: 'video',
    id,
    props: {
      src: YOUTUBE,
      provider: 'youtube',
      posterMediaId: null,
      posterSrc: null,
      classes: [],
      ...props,
    },
    children: [],
  };
}

function map(props: Record<string, unknown>, id = blockId()) {
  return {
    type: 'map',
    id,
    props: {
      address: 'Via Sintetica 1, Città di prova',
      lat: '41.9',
      lng: '12.5',
      zoom: 15,
      mouseWheel: false,
      mobileDragging: false,
      grayscale: false,
      grayscaleAmount: null,
      pins: [],
      classes: [],
      ...props,
    },
    children: [],
  };
}

function documentBlock(props: Record<string, unknown>, id = blockId()) {
  return {
    type: 'document',
    id,
    props: { documentId: documentPublic, label: null, display: 'link', classes: [], ...props },
    children: [],
  };
}

const doc = (...blocks: unknown[]) => ({ schema: 1, blocks });

async function insertMedia(path: string, mimeType: string, isPrivate: boolean) {
  const name = path.split('/').pop() ?? 'file';
  const [row] = await harness.db
    .insert(schema.media)
    .values({
      storageKey: path.replace('/media/', ''),
      publicPath: path,
      fileName: name,
      mimeType,
      byteSize: 4,
      checksum: Buffer.from(name.padEnd(32, '0').slice(0, 32)),
      isPrivate,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media di prova non creato');
  return row.id;
}

async function insertDocument(slug: string, mediaId: string, isPrivate: boolean) {
  const [row] = await harness.db
    .insert(schema.documents)
    .values({ slug, title: `Documento ${slug}`, mediaId, isPrivate })
    .returning({ id: schema.documents.id });
  if (!row) throw new Error('documento di prova non creato');
  return row.id;
}

/** Un contenuto con i blocchi scritti direttamente, come li lascia l'importer. */
async function newContent(blocks: unknown[] = []) {
  counter += 1;
  const [row] = await harness.db
    .insert(schema.contents)
    .values({
      type: 'page',
      status: 'published',
      slug: `contenuto-dr279-${counter}`,
      path: `/contenuto-dr279-${counter}/`,
      title: `Titolo sintetico ${counter}`,
      contentText: 'testo sintetico',
      blocks: doc(...blocks),
      publishedAt: new Date('2026-02-01T10:00:00Z'),
    })
    .returning({
      id: schema.contents.id,
      path: schema.contents.path,
      updatedAt: schema.contents.updatedAt,
    });
  if (!row) throw new Error('contenuto di prova non creato');
  return row;
}

beforeAll(async () => {
  harness = await createHarness('api_blocchi_dr279');
  signed = await signIn(harness, { area: 'redazione' });
  await insertMedia(VIDEO_PUBLIC, 'video/mp4', false);
  await insertMedia(VIDEO_PRIVATE, 'video/mp4', true);
  await insertMedia(WEBM_PUBLIC, 'video/webm', false);
  imagePublicId = await insertMedia(IMAGE_PUBLIC, 'image/png', false);
  imagePrivateId = await insertMedia(IMAGE_PRIVATE, 'image/png', true);
  const pdfPublic = await insertMedia(
    '/media/2026/01/modulo-sintetico.pdf',
    'application/pdf',
    false,
  );
  const pdfPrivate = await insertMedia(
    '/media/2026/01/modulo-riservato.pdf',
    'application/pdf',
    true,
  );
  documentPublic = await insertDocument('modulo-sintetico', pdfPublic, false);
  documentPrivate = await insertDocument('modulo-riservato', pdfPrivate, true);
  // Un documento pubblico il cui file è stato reso riservato: non si offre neppure lui.
  documentPrivateFile = await insertDocument('modulo-file-riservato', pdfPrivate, false);
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

const putDraft = (id: string, blocks: unknown, baseUpdatedAt: Date) =>
  harness.app.inject({
    method: 'PUT',
    url: `/contents/${id}/draft`,
    headers: signed.writeHeaders,
    payload: { title: 'Titolo sintetico', blocks, baseUpdatedAt: baseUpdatedAt.toISOString() },
  });

const create = (blocks: unknown) =>
  harness.app.inject({
    method: 'POST',
    url: '/contents',
    headers: signed.writeHeaders,
    payload: { type: 'page', slug: `nuova-dr279-${blockId().slice(2)}`, title: 'Nuova', blocks },
  });

const publicContent = (path: string) =>
  harness.app.inject({ method: 'GET', url: `/public/content?path=${path}` });

interface ErrorBody {
  error: { code: string; message: string };
}

function expectRejected(
  response: { statusCode: number; body: string; json: () => unknown },
  code: string,
) {
  expect(response.statusCode, response.body).toBe(400);
  const body = response.json() as ErrorBody;
  expect(body.error.code).toBe(code);
  // Il messaggio è in italiano e non è quello generico di Zod.
  expect(body.error.message).toMatch(/[àèéìòù]|video|documento|mappa|segnaposto|immagine/i);
}

async function storedBlocks(id: string) {
  const [row] = await harness.db
    .select({ blocks: schema.contents.blocks })
    .from(schema.contents)
    .where(eq(schema.contents.id, id));
  return row?.blocks as { blocks: { props: Record<string, unknown> }[] };
}

async function lastAudit(action: string, entityId: string) {
  const [row] = await harness.db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.action, action), eq(schema.auditLog.entityId, entityId)))
    .orderBy(desc(schema.auditLog.occurredAt))
    .limit(1);
  return row;
}

describe('video: YouTube (DR-279)', () => {
  it('un indirizzo YouTube canonico si salva, il sito lo riceve e il registro lo annota', async () => {
    const page = await newContent([video({ src: VIDEO_PUBLIC, provider: 'file' })]);
    const original = await storedBlocks(page.id);
    const id = (original.blocks[0] as unknown as { id: string }).id;
    const response = await patch(page.id, { blocks: doc(video({}, id)) });
    expect(response.statusCode, response.body).toBe(200);
    expect((await storedBlocks(page.id)).blocks[0]?.props.src).toBe(YOUTUBE);

    const site = await publicContent(page.path);
    expect(site.body).toContain(YOUTUBE);

    const audit = await lastAudit('content.update', page.id);
    expect(audit?.detail).toMatchObject({ fields: ['Contenuto'] });
  });

  it.each([
    ['un altro fornitore', { src: 'https://vimeo.com/12345', provider: 'vimeo' }],
    ['un host qualsiasi', { src: 'https://example.com/video.mp4', provider: 'other' }],
    [
      'un host che finge di essere YouTube',
      { src: 'https://youtube.com.evil.example/watch?v=aBcDeFgHi_-', provider: 'youtube' },
    ],
    ['javascript:', { src: 'javascript:alert(1)', provider: 'other' }],
    ['data:', { src: 'data:text/html,<script>alert(1)</script>', provider: 'other' }],
    ['http, non https', { src: 'http://www.youtube.com/watch?v=aBcDeFgHi_-', provider: 'youtube' }],
    [
      'una forma non canonica',
      { src: 'https://www.youtube.com/embed/aBcDeFgHi_-', provider: 'youtube' },
    ],
    ['un YouTube dichiarato «file»', { src: YOUTUBE, provider: 'file' }],
    ['un file dichiarato «youtube»', { src: VIDEO_PUBLIC, provider: 'youtube' }],
  ])('rifiuta %s', async (_caso, props) => {
    const page = await newContent();
    const response = await patch(page.id, { blocks: doc(video(props)) });
    expectRejected(response, 'CONTENT_BLOCK_INVALID');
    expect((await storedBlocks(page.id)).blocks).toEqual([]);
  });
});

describe('video: MP4 della libreria (DR-279)', () => {
  it('un MP4 pubblico si salva, con un’anteprima pubblica', async () => {
    const page = await newContent();
    const response = await patch(page.id, {
      blocks: doc(video({ src: VIDEO_PUBLIC, provider: 'file', posterSrc: IMAGE_PUBLIC })),
    });
    expect(response.statusCode, response.body).toBe(200);
    const site = await publicContent(page.path);
    expect(site.body).toContain(VIDEO_PUBLIC);
  });

  it('l’anteprima può essere anche un’immagine scelta per identificativo, se pubblica', async () => {
    const page = await newContent();
    const response = await patch(page.id, {
      blocks: doc(video({ src: VIDEO_PUBLIC, provider: 'file', posterMediaId: imagePublicId })),
    });
    expect(response.statusCode, response.body).toBe(200);
  });

  it.each([
    ['un media riservato', { src: VIDEO_PRIVATE, provider: 'file' }],
    [
      'un file che non è nella libreria',
      { src: '/media/2026/01/inesistente.mp4', provider: 'file' },
    ],
    ['un video che non è MP4', { src: WEBM_PUBLIC, provider: 'file' }],
    ['un’immagine al posto del video', { src: IMAGE_PUBLIC, provider: 'file' }],
    [
      'un’anteprima riservata (percorso)',
      { src: VIDEO_PUBLIC, provider: 'file', posterSrc: IMAGE_PRIVATE },
    ],
    [
      'un’anteprima esterna',
      { src: VIDEO_PUBLIC, provider: 'file', posterSrc: 'https://example.com/a.png' },
    ],
    [
      'un’anteprima javascript:',
      { src: VIDEO_PUBLIC, provider: 'file', posterSrc: 'javascript:alert(1)' },
    ],
  ])('rifiuta %s', async (_caso, props) => {
    const page = await newContent();
    const response = await patch(page.id, { blocks: doc(video(props)) });
    expectRejected(response, 'CONTENT_BLOCK_INVALID');
  });

  it('rifiuta un’anteprima riservata scelta per identificativo', async () => {
    const page = await newContent();
    const response = await patch(page.id, {
      blocks: doc(video({ src: VIDEO_PUBLIC, provider: 'file', posterMediaId: imagePrivateId })),
    });
    expectRejected(response, 'CONTENT_BLOCK_INVALID');
  });
});

describe('documento (DR-279)', () => {
  it('un documento pubblico si sceglie, con etichetta e visualizzazione', async () => {
    const page = await newContent();
    const response = await patch(page.id, {
      blocks: doc(documentBlock({ label: 'Scarica il modulo', display: 'card' })),
    });
    expect(response.statusCode, response.body).toBe(200);
    expect((await storedBlocks(page.id)).blocks[0]?.props).toMatchObject({
      documentId: documentPublic,
      label: 'Scarica il modulo',
      display: 'card',
    });
  });

  it('rifiuta un documento riservato', async () => {
    const page = await newContent();
    const response = await patch(page.id, {
      blocks: doc(documentBlock({ documentId: documentPrivate })),
    });
    expectRejected(response, 'CONTENT_BLOCK_INVALID');
  });

  it('rifiuta un documento il cui file è riservato', async () => {
    const page = await newContent();
    const response = await patch(page.id, {
      blocks: doc(documentBlock({ documentId: documentPrivateFile })),
    });
    expectRejected(response, 'CONTENT_BLOCK_INVALID');
  });

  it('rifiuta un documento che non esiste', async () => {
    const page = await newContent();
    const response = await patch(page.id, {
      blocks: doc(documentBlock({ documentId: '00000000-0000-4000-8000-0000000000d1' })),
    });
    expectRejected(response, 'CONTENT_BLOCK_INVALID');
  });

  it('rifiuta una visualizzazione fuori elenco (schema condiviso)', async () => {
    const page = await newContent();
    const response = await patch(page.id, { blocks: doc(documentBlock({ display: 'iframe' })) });
    expect(response.statusCode, response.body).toBe(400);
  });
});

describe('mappa (DR-279)', () => {
  const PIN_HTML = '<p>Segnaposto <strong>importato</strong></p>';

  it('indirizzo, coordinate, zoom, interruttori e segnaposto si cambiano; l’html resta', async () => {
    const original = map({ pins: [{ title: 'Sede', lat: '41.9', lng: '12.5', html: PIN_HTML }] });
    const page = await newContent([original]);
    const changed = map(
      {
        address: 'Piazza Sintetica 2',
        lat: '45.4642',
        lng: '9.19',
        zoom: 12,
        mouseWheel: true,
        mobileDragging: true,
        grayscale: true,
        grayscaleAmount: 40,
        // La scala di grigi è anche una classe dichiarata (§7.2): l'editor le tiene insieme.
        classes: ['map-grayscale'],
        pins: [
          { title: 'Nuova sede', lat: '45.4642', lng: '9.19', html: PIN_HTML },
          { title: 'Secondo ingresso', lat: '45.465', lng: '9.191', html: null },
        ],
      },
      original.id,
    );
    const response = await patch(page.id, { blocks: doc(changed) });
    expect(response.statusCode, response.body).toBe(200);
    expect((await storedBlocks(page.id)).blocks[0]?.props).toMatchObject({
      address: 'Piazza Sintetica 2',
      zoom: 12,
      pins: [
        { title: 'Nuova sede', html: PIN_HTML },
        { title: 'Secondo ingresso', html: null },
      ],
    });
  });

  it('rifiuta un html di segnaposto cambiato', async () => {
    const original = map({ pins: [{ title: 'Sede', lat: '41.9', lng: '12.5', html: PIN_HTML }] });
    const page = await newContent([original]);
    const changed = map(
      {
        pins: [{ title: 'Sede', lat: '41.9', lng: '12.5', html: '<img src=x onerror=alert(1)>' }],
      },
      original.id,
    );
    expectRejected(await patch(page.id, { blocks: doc(changed) }), 'CONTENT_BLOCK_INVALID');
  });

  it('rifiuta un html in un segnaposto nuovo', async () => {
    const page = await newContent();
    const changed = map({
      pins: [{ title: 'Sede', lat: '41.9', lng: '12.5', html: '<script>alert(1)</script>' }],
    });
    expectRejected(await patch(page.id, { blocks: doc(changed) }), 'CONTENT_BLOCK_INVALID');
  });

  it.each([
    ['latitudine non numerica', { lat: '41,9' }],
    ['longitudine con testo', { lng: '12.5; drop' }],
    ['zoom 0', { zoom: 0 }],
    ['zoom 22', { zoom: 22 }],
    ['indirizzo vuoto', { address: '' }],
  ])('rifiuta %s (schema condiviso)', async (_caso, props) => {
    const page = await newContent();
    const response = await patch(page.id, { blocks: doc(map(props)) });
    expect(response.statusCode, response.body).toBe(400);
  });
});

describe('blocchi invariati e altre vie di scrittura (DR-279)', () => {
  it('un blocco importato fuori regola, non toccato, resta salvabile così com’è (1D-36)', async () => {
    const vimeo = video({ src: 'https://vimeo.com/12345', provider: 'vimeo' });
    const page = await newContent([vimeo]);
    const before = await storedBlocks(page.id);
    const response = await patch(page.id, { blocks: before });
    expect(response.statusCode, response.body).toBe(200);
    expect(await storedBlocks(page.id)).toEqual(before);
  });

  it('ma se lo si modifica deve rispettare le regole', async () => {
    const vimeo = video({ src: 'https://vimeo.com/12345', provider: 'vimeo' });
    const page = await newContent([vimeo]);
    const changed = video({ src: 'https://vimeo.com/99999', provider: 'vimeo' }, vimeo.id);
    expectRejected(await patch(page.id, { blocks: doc(changed) }), 'CONTENT_BLOCK_INVALID');
  });

  it('la copia di lavoro rifiuta lo stesso indirizzo', async () => {
    const page = await newContent();
    const response = await putDraft(
      page.id,
      doc(video({ src: 'https://youtube.com.evil.example/watch?v=aBcDeFgHi_-' })),
      page.updatedAt,
    );
    expectRejected(response, 'CONTENT_BLOCK_INVALID');
  });

  it('la copia di lavoro accetta un documento pubblico e rifiuta uno riservato', async () => {
    const page = await newContent();
    const ok = await putDraft(page.id, doc(documentBlock({})), page.updatedAt);
    expect(ok.statusCode, ok.body).toBe(200);
    const ko = await putDraft(
      page.id,
      doc(documentBlock({ documentId: documentPrivate })),
      page.updatedAt,
    );
    expectRejected(ko, 'CONTENT_BLOCK_INVALID');
  });

  it('la creazione rifiuta un video riservato', async () => {
    const response = await create(doc(video({ src: VIDEO_PRIVATE, provider: 'file' })));
    expectRejected(response, 'CONTENT_BLOCK_INVALID');
  });

  it('i blocchi dentro sezioni e colonne si controllano anch’essi', async () => {
    const page = await newContent();
    const nested = {
      type: 'section',
      id: blockId(),
      props: {},
      children: [
        {
          type: 'row',
          id: blockId(),
          props: { columnStructure: '4_4' },
          children: [
            {
              type: 'column',
              id: blockId(),
              props: { width: '4_4' },
              children: [documentBlock({ documentId: documentPrivate })],
            },
          ],
        },
      ],
    };
    const response = await patch(page.id, { blocks: doc(nested) });
    // Lo schema condiviso completa i valori predefiniti di sezione, riga e colonna.
    expectRejected(response, 'CONTENT_BLOCK_INVALID');
  });
});

/**
 * Giro 1 della revisione: il confronto con i blocchi salvati va per identificativo e per tipo,
 * quindi riordinare non rivaluta, duplicare (con un identificativo nuovo) sì, e un
 * identificativo riusato con un altro tipo conta come blocco nuovo. L'html dei segnaposto si
 * confronta come insieme di testi già salvati nel blocco: spostarlo da un segnaposto all'altro
 * non fa entrare HTML nuovo ed è ammesso; copiarlo in un secondo segnaposto no.
 */
describe('identità dei blocchi (DR-279, giro 1)', () => {
  const PIN_HTML = '<p>Fumetto <em>importato</em></p>';

  it('riordinare blocchi invariati, anche uno importato fuori regola, non li rivaluta', async () => {
    const vimeo = video({ src: 'https://vimeo.com/12345', provider: 'vimeo' });
    const riservato = documentBlock({ documentId: documentPrivate });
    const page = await newContent([vimeo, riservato]);
    const response = await patch(page.id, { blocks: doc(riservato, vimeo) });
    expect(response.statusCode, response.body).toBe(200);
    expect(
      (await storedBlocks(page.id)).blocks.map((b) => (b as unknown as { id: string }).id),
    ).toEqual([riservato.id, vimeo.id]);
  });

  it('un duplicato con un identificativo nuovo si valuta come blocco nuovo', async () => {
    const vimeo = video({ src: 'https://vimeo.com/12345', provider: 'vimeo' });
    const page = await newContent([vimeo]);
    const copia = { ...vimeo, id: blockId() };
    expectRejected(await patch(page.id, { blocks: doc(vimeo, copia) }), 'CONTENT_BLOCK_INVALID');

    const youtube = video({});
    const page2 = await newContent([youtube]);
    const ok = await patch(page2.id, { blocks: doc(youtube, { ...youtube, id: blockId() }) });
    expect(ok.statusCode, ok.body).toBe(200);
  });

  it('un duplicato con lo stesso identificativo è rifiutato', async () => {
    const youtube = video({});
    const page = await newContent([youtube]);
    // Anche una copia valida: con lo stesso id una copia di un blocco fuori regola passerebbe per invariata.
    expectRejected(
      await patch(page.id, { blocks: doc(youtube, youtube) }),
      'CONTENT_BLOCK_INVALID',
    );
    const vimeo = video({ src: 'https://vimeo.com/12345', provider: 'vimeo' });
    const page2 = await newContent([vimeo]);
    expectRejected(await patch(page2.id, { blocks: doc(vimeo, vimeo) }), 'CONTENT_BLOCK_INVALID');
  });

  it('un identificativo riusato con un altro tipo conta come blocco nuovo', async () => {
    const riservato = documentBlock({ documentId: documentPrivate });
    const page = await newContent([riservato]);
    const finto = video({ src: 'https://vimeo.com/12345', provider: 'vimeo' }, riservato.id);
    expectRejected(await patch(page.id, { blocks: doc(finto) }), 'CONTENT_BLOCK_INVALID');

    const vimeo = video({ src: 'https://vimeo.com/12345', provider: 'vimeo' });
    const page2 = await newContent([vimeo]);
    const altro = documentBlock({ documentId: documentPrivate }, vimeo.id);
    expectRejected(await patch(page2.id, { blocks: doc(altro) }), 'CONTENT_BLOCK_INVALID');

    const mappa = map({ pins: [{ title: 'Sede', lat: '41.9', lng: '12.5', html: PIN_HTML }] });
    const page3 = await newContent([vimeo, mappa]);
    // L'html di una mappa salvata non si porta in una mappa nuova che riusa l'id di un video.
    const mappaFinta = map(
      { pins: [{ title: 'Sede', lat: '41.9', lng: '12.5', html: PIN_HTML }] },
      vimeo.id,
    );
    expectRejected(
      await patch(page3.id, { blocks: doc(mappaFinta, { ...mappa, id: blockId() }) }),
      'CONTENT_BLOCK_INVALID',
    );
  });

  it('l’html spostato da un segnaposto all’altro della stessa mappa è ammesso, così com’è', async () => {
    const mappa = map({
      pins: [
        { title: 'Primo', lat: '41.9', lng: '12.5', html: PIN_HTML },
        { title: 'Secondo', lat: '41.8', lng: '12.4', html: null },
      ],
    });
    const page = await newContent([mappa]);
    const spostato = map(
      {
        pins: [
          { title: 'Primo', lat: '41.9', lng: '12.5', html: null },
          { title: 'Secondo', lat: '41.8', lng: '12.4', html: PIN_HTML },
        ],
      },
      mappa.id,
    );
    const response = await patch(page.id, { blocks: doc(spostato) });
    expect(response.statusCode, response.body).toBe(200);
    expect((await storedBlocks(page.id)).blocks[0]?.props.pins).toEqual([
      { title: 'Primo', lat: '41.9', lng: '12.5', html: null },
      { title: 'Secondo', lat: '41.8', lng: '12.4', html: PIN_HTML },
    ]);
  });

  it('l’html copiato in un secondo segnaposto è rifiutato', async () => {
    const mappa = map({ pins: [{ title: 'Primo', lat: '41.9', lng: '12.5', html: PIN_HTML }] });
    const page = await newContent([mappa]);
    const copiato = map(
      {
        pins: [
          { title: 'Primo', lat: '41.9', lng: '12.5', html: PIN_HTML },
          { title: 'Secondo', lat: '41.8', lng: '12.4', html: PIN_HTML },
        ],
      },
      mappa.id,
    );
    expectRejected(await patch(page.id, { blocks: doc(copiato) }), 'CONTENT_BLOCK_INVALID');
  });

  it('l’html di un’altra mappa della stessa pagina non si porta in questa', async () => {
    const prima = map({ pins: [{ title: 'Uno', lat: '41.9', lng: '12.5', html: PIN_HTML }] });
    const seconda = map({ pins: [] });
    const page = await newContent([prima, seconda]);
    const presa = map(
      { pins: [{ title: 'Due', lat: '41.9', lng: '12.5', html: PIN_HTML }] },
      seconda.id,
    );
    expectRejected(await patch(page.id, { blocks: doc(prima, presa) }), 'CONTENT_BLOCK_INVALID');
  });
});
