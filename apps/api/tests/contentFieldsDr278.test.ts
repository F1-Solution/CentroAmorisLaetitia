import { schema } from '@amoris/db';
import { and, desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * DR-278 (wave 1G-W7, T2e): cinque campi di pagine e notizie diventano modificabili
 * dall'area. Qui la parte dell'API:
 *
 * - «mostrare il titolo», «spazio fra le colonne», «notizia in primo piano» e
 *   l'immagine in evidenza delle pagine passano da `PATCH /contents/:id`, con la
 *   validazione e i messaggi in italiano;
 * - il tipo di dati strutturati si sceglie nella SEO del contenuto e nei modelli
 *   SEO, solo fra i valori che il sito sa produrre; il sito lo riceve risolto in
 *   `seo.schemaType` (sovrascrittura, poi modello, poi il predefinito del tipo);
 * - il registro delle operazioni porta i nomi in italiano dei campi cambiati,
 *   mai i valori.
 *
 * Dati sintetici.
 */

let harness: Harness;
let signed: Signed;
let image: string;
let counter = 0;

async function newContent(type: 'page' | 'post', values: { published?: boolean } = {}) {
  counter += 1;
  const published = values.published ?? true;
  const [row] = await harness.db
    .insert(schema.contents)
    .values({
      type,
      status: published ? 'published' : 'draft',
      slug: `contenuto-dr278-${counter}`,
      path: `/contenuto-dr278-${counter}/`,
      title: `Titolo sintetico ${counter}`,
      contentText: 'testo sintetico',
      blocks: { schema: 1, blocks: [] },
      publishedAt: published ? new Date('2026-02-01T10:00:00Z') : null,
    })
    .returning({ id: schema.contents.id, path: schema.contents.path });
  if (!row) throw new Error('contenuto di prova non creato');
  return row;
}

beforeAll(async () => {
  harness = await createHarness('api_campi_dr278');
  signed = await signIn(harness, { area: 'redazione' });
  const [media] = await harness.db
    .insert(schema.media)
    .values({
      storageKey: '2026/01/evidenza-sintetica.png',
      publicPath: '/media/2026/01/evidenza-sintetica.png',
      fileName: 'evidenza-sintetica.png',
      mimeType: 'image/png',
      byteSize: 4,
      checksum: Buffer.from('evidenza-sintetica'.padEnd(32, '0')),
      title: 'Immagine sintetica',
      width: 800,
      height: 600,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!media) throw new Error('media di prova non creato');
  image = media.id;
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

const read = (id: string) =>
  harness.app.inject({ method: 'GET', url: `/contents/${id}`, headers: { cookie: signed.cookie } });

const publicContent = (path: string) =>
  harness.app.inject({ method: 'GET', url: `/public/content?path=${path}` });

interface ErrorBody {
  error: { code: string; message: string; details?: { message: string }[] };
}

/** Il messaggio che arriva alla persona: quello del servizio o quelli della validazione. */
function messages(body: ErrorBody): string {
  return [body.error.message, ...(body.error.details ?? []).map((d) => d.message)].join(' | ');
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

describe('mostrare il titolo (DR-278)', () => {
  it('si spegne e si riaccende; il sito lo riceve', async () => {
    const page = await newContent('page');
    const spento = await patch(page.id, { showTitle: false });
    expect(spento.statusCode, spento.body).toBe(200);
    expect(spento.json().showTitle).toBe(false);
    expect((await publicContent(page.path)).json().content.showTitle).toBe(false);

    expect((await patch(page.id, { showTitle: true })).json().showTitle).toBe(true);
    expect((await publicContent(page.path)).json().content.showTitle).toBe(true);
  });
});

describe('spazio fra le colonne (DR-278, DR-149)', () => {
  it('il dettaglio lo espone: nullo è il valore del tema', async () => {
    const page = await newContent('page');
    expect((await read(page.id)).json().gutterWidth).toBeNull();
  });

  it('si sceglie fra 1 e 4, si rilegge, e il sito lo riceve', async () => {
    const page = await newContent('page');
    const scelto = await patch(page.id, { gutterWidth: 3 });
    expect(scelto.statusCode, scelto.body).toBe(200);
    expect(scelto.json().gutterWidth).toBe(3);
    expect((await read(page.id)).json().gutterWidth).toBe(3);
    expect((await publicContent(page.path)).json().content.gutterWidth).toBe(3);

    // Tornare al valore del tema.
    expect((await patch(page.id, { gutterWidth: null })).json().gutterWidth).toBeNull();
    expect((await publicContent(page.path)).json().content.gutterWidth).toBeNull();
  });

  it.each([0, 5, 2.5, '3'])(
    'prova negativa: %s è respinto con un messaggio in italiano',
    async (value) => {
      const page = await newContent('page');
      const respinto = await patch(page.id, { gutterWidth: value });
      expect(respinto.statusCode).toBe(400);
      expect(messages(respinto.json())).toContain('Lo spazio fra le colonne è un valore da 1 a 4');
      expect((await read(page.id)).json().gutterWidth).toBeNull();
    },
  );
});

describe('notizia in primo piano (DR-278)', () => {
  it('una notizia si mette e si toglie dal primo piano', async () => {
    const post = await newContent('post');
    const messa = await patch(post.id, { isSticky: true });
    expect(messa.statusCode, messa.body).toBe(200);
    expect(messa.json().isSticky).toBe(true);
    expect((await patch(post.id, { isSticky: false })).json().isSticky).toBe(false);
  });

  it('prova negativa: una pagina non va in primo piano', async () => {
    const page = await newContent('page');
    const respinto = await patch(page.id, { isSticky: true });
    expect(respinto.statusCode).toBe(400);
    expect((respinto.json() as ErrorBody).error.code).toBe('CONTENT_STICKY_POST_ONLY');
    expect((respinto.json() as ErrorBody).error.message).toBe(
      'Solo una notizia può essere messa in primo piano.',
    );
    expect((await read(page.id)).json().isSticky).toBe(false);
  });

  it('a una pagina «in primo piano: no» resta ammesso, come prima', async () => {
    const page = await newContent('page');
    expect((await patch(page.id, { isSticky: false })).statusCode).toBe(200);
  });
});

describe('immagine in evidenza di una pagina (DR-278)', () => {
  it('si sceglie e si toglie con la stessa rotta delle notizie; il sito la riceve fra i media', async () => {
    const page = await newContent('page');
    const scelta = await patch(page.id, { featuredMediaId: image });
    expect(scelta.statusCode, scelta.body).toBe(200);
    const detail = (await read(page.id)).json();
    expect(detail.featuredMediaId).toBe(image);
    expect(detail.featuredMedia.id).toBe(image);

    const pubblica = (await publicContent(page.path)).json();
    expect(pubblica.content.featuredMediaId).toBe(image);
    expect(pubblica.media[image].publicPath).toBe('/media/2026/01/evidenza-sintetica.png');
    // La sorgente non dava alle pagine un'immagine di condivisione dall'evidenza.
    expect(pubblica.seo.ogImagePath).toBeNull();

    expect((await patch(page.id, { featuredMediaId: null })).json().featuredMediaId).toBeNull();
  });
});

describe('registro delle operazioni: i campi cambiati in italiano, mai i valori', () => {
  it('PATCH /contents/:id elenca le etichette dei campi inviati', async () => {
    const post = await newContent('post');
    const risposta = await patch(post.id, {
      showTitle: false,
      gutterWidth: 4,
      isSticky: true,
      featuredMediaId: image,
    });
    expect(risposta.statusCode, risposta.body).toBe(200);
    const row = await lastAudit('content.update', post.id);
    const detail = row?.detail as { fields?: string[] };
    expect(detail.fields).toEqual([
      'Mostrare il titolo',
      'Spazio fra le colonne',
      'Notizia in primo piano',
      'Immagine in evidenza',
    ]);
    expect(JSON.stringify(row?.detail)).not.toContain(image);
  });

  it('la SEO del contenuto registra i soli campi cambiati, anche se il pannello li invia tutti', async () => {
    const page = await newContent('page');
    // Il corpo che il pannello SEO invia sempre: tutti i campi, vuoti dove non scritti.
    const fullBody = (schemaType: string | null) => ({
      title: 'Titolo SEO sintetico',
      description: null,
      canonicalUrl: null,
      ogTitle: null,
      ogDescription: null,
      ogImageId: null,
      robotsNoindex: false,
      robotsNofollow: false,
      schemaType,
    });
    const put = (payload: Record<string, unknown>) =>
      harness.app.inject({
        method: 'PUT',
        url: `/seo/contents/${page.id}`,
        headers: signed.writeHeaders,
        payload,
      });
    expect((await put(fullBody(null))).statusCode).toBe(200);
    const prima = await lastAudit('seo.content.update', page.id);
    // Alla nascita della sovrascrittura conta ciò che si scosta dal vuoto.
    expect((prima?.detail as { fields?: string[] }).fields).toEqual(['Titolo SEO']);

    expect((await put(fullBody('BlogPosting'))).statusCode).toBe(200);
    const dopo = await lastAudit('seo.content.update', page.id);
    expect((dopo?.detail as { fields?: string[] }).fields).toEqual(['Tipo di dati strutturati']);

    expect((await put(fullBody('BlogPosting'))).statusCode).toBe(200);
    const uguale = await lastAudit('seo.content.update', page.id);
    expect((uguale?.detail as { fields?: string[] }).fields).toEqual([]);
  });

  it('un modello SEO registra i soli campi che cambiano davvero', async () => {
    const put = (schemaType: string | null) =>
      harness.app.inject({
        method: 'PUT',
        url: '/seo/templates/home',
        headers: signed.writeHeaders,
        payload: { titleTemplate: '{site_title}', schemaType },
      });
    expect((await put(null)).statusCode).toBe(200);
    expect((await put('WebPage')).statusCode).toBe(200);
    const row = await lastAudit('seo.template.update', 'home');
    expect((row?.detail as { fields?: string[] }).fields).toEqual(['Tipo di dati strutturati']);
  });
});

describe('tipo di dati strutturati (DR-278)', () => {
  const putTemplate = (scope: string, payload: Record<string, unknown>) =>
    harness.app.inject({
      method: 'PUT',
      url: `/seo/templates/${scope}`,
      headers: signed.writeHeaders,
      payload: { titleTemplate: '{title} - {site_title}', ...payload },
    });

  const putContentSeo = (id: string, payload: Record<string, unknown>) =>
    harness.app.inject({
      method: 'PUT',
      url: `/seo/contents/${id}`,
      headers: signed.writeHeaders,
      payload,
    });

  it('senza scelte il sito riceve il predefinito: pagina WebPage, notizia BlogPosting', async () => {
    const page = await newContent('page');
    const post = await newContent('post');
    expect((await publicContent(page.path)).json().seo.schemaType).toBe('WebPage');
    expect((await publicContent(post.path)).json().seo.schemaType).toBe('BlogPosting');
  });

  it('il modello delle pagine vale per tutte le pagine; la sovrascrittura del contenuto vince', async () => {
    const page = await newContent('page');
    const other = await newContent('page');
    const modello = await putTemplate('page', { schemaType: 'BlogPosting' });
    expect(modello.statusCode, modello.body).toBe(200);
    expect(modello.json().schemaType).toBe('BlogPosting');
    expect((await publicContent(page.path)).json().seo.schemaType).toBe('BlogPosting');

    const proprio = await putContentSeo(other.id, { schemaType: 'WebPage' });
    expect(proprio.statusCode, proprio.body).toBe(200);
    expect(proprio.json().schemaType).toBe('WebPage');
    expect((await publicContent(other.path)).json().seo.schemaType).toBe('WebPage');

    // Una sovrascrittura che non nomina il tipo non lo cancella.
    await putContentSeo(other.id, { title: 'Titolo SEO sintetico' });
    expect((await publicContent(other.path)).json().seo.schemaType).toBe('WebPage');

    // Tornare al predefinito.
    await putTemplate('page', { schemaType: null });
    expect((await publicContent(page.path)).json().seo.schemaType).toBe('WebPage');
  });

  it.each(['Article', 'Product', '', 'webpage'])(
    'prova negativa: «%s» non è un tipo ammesso, né nel contenuto né nel modello',
    async (value) => {
      const page = await newContent('page');
      const nelContenuto = await putContentSeo(page.id, { schemaType: value });
      expect(nelContenuto.statusCode).toBe(400);
      expect(messages(nelContenuto.json())).toContain(
        'Il tipo di dati strutturati è «WebPage» o «BlogPosting»',
      );
      const nelModello = await putTemplate('post', { schemaType: value });
      expect(nelModello.statusCode).toBe(400);
      expect(messages(nelModello.json())).toContain(
        'Il tipo di dati strutturati è «WebPage» o «BlogPosting»',
      );
    },
  );

  it('prova negativa: nei modelli che non rendono un contenuto il tipo non si sceglie', async () => {
    const respinto = await putTemplate('category', { schemaType: 'WebPage' });
    expect(respinto.statusCode).toBe(400);
    expect((respinto.json() as ErrorBody).error.message).toBe(
      'Il tipo di dati strutturati si sceglie solo nei modelli della pagina iniziale, delle pagine e delle notizie.',
    );
    // Vuoto resta ammesso: il salvataggio degli altri campi del modello non cambia.
    expect((await putTemplate('category', { schemaType: null })).statusCode).toBe(200);
  });
});
