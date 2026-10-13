import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness } from './_support/harness.js';

/**
 * La lettura pubblica (DR-104) e il controllo di eliminazione dei media per
 * indirizzo (DR-109), sul database usa e getta del banco di prova.
 *
 * Il criterio 1E-16 chiede una **prova negativa per ogni rotta**: bozze,
 * contenuti ritirati, media e documenti riservati, voci di menu non pubbliche,
 * impostazioni fuori elenco non devono uscire. Ogni `describe` qui sotto ha la
 * sua. Tutti i dati sono sintetici.
 */

let h: Harness;
const ids: Record<string, string> = {};
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

async function media(
  key: string,
  values: { path: string; isPrivate?: boolean; variants?: string[] },
): Promise<string> {
  const storageKey = values.path.replace(/^\/media\//, '');
  const [row] = await h.db
    .insert(schema.media)
    .values({
      storageKey,
      publicPath: values.path,
      fileName: storageKey.split('/').pop() ?? storageKey,
      mimeType: 'image/png',
      byteSize: PNG.length,
      width: 100,
      height: 50,
      checksum: Buffer.from(key.padEnd(32, '0')),
      altText: `Testo alternativo ${key}`,
      isPrivate: values.isPrivate ?? false,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media non creato');
  const bucket = values.isPrivate ? 'media-private' : 'media-public';
  h.store.objects.set(`${bucket}/${storageKey}`, PNG);
  for (const [n, variantPath] of (values.variants ?? []).entries()) {
    const variantKey = variantPath.replace(/^\/media\//, '');
    await h.db.insert(schema.mediaVariants).values({
      mediaId: row.id,
      storageKey: variantKey,
      publicPath: variantPath,
      width: 10 * (n + 1),
      height: 5 * (n + 1),
      byteSize: PNG.length,
      checksum: Buffer.from(`${key}-${n}`.padEnd(32, '0')),
    });
    h.store.objects.set(`${bucket}/${variantKey}`, PNG);
  }
  ids[key] = row.id;
  return row.id;
}

async function content(
  key: string,
  values: {
    path: string;
    status: 'draft' | 'published' | 'archived';
    type?: 'page' | 'post';
    blocks?: unknown[];
    excerpt?: string;
    text?: string;
    publishedAt?: string;
  },
): Promise<string> {
  const [row] = await h.db
    .insert(schema.contents)
    .values({
      type: values.type ?? 'page',
      status: values.status,
      slug: values.path.split('/').filter(Boolean).pop() ?? 'home',
      path: values.path,
      title: `Titolo ${key}`,
      excerpt: values.excerpt ?? null,
      contentText: values.text ?? '',
      blocks: { schema: 1, blocks: values.blocks ?? [] },
      publishedAt:
        values.status === 'published'
          ? new Date(values.publishedAt ?? '2026-02-01T10:00:00Z')
          : null,
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('contenuto non creato');
  ids[key] = row.id;
  return row.id;
}

beforeAll(async () => {
  h = await createHarness('amoris_api_public');

  await media('pubblico', {
    path: '/media/2026/01/pubblico.png',
    variants: ['/media/2026/01/pubblico-10x5.png'],
  });
  await media('riservato', { path: '/media/2026/01/riservato.png', isPrivate: true });
  await media('accentato', { path: '/media/2026/01/genitorialità.png' });
  await media('citatoPerIndirizzo', {
    path: '/media/2026/01/citato.png',
    variants: ['/media/2026/01/citato-300x200.png'],
  });
  await media('citatoCodificato', { path: '/media/2026/01/città-codificata.png' });
  await media('libero', { path: '/media/2026/01/libero.png' });

  const [slider] = await h.db
    .insert(schema.sliders)
    .values({ key: 'home', title: 'Carosello sintetico' })
    .returning({ id: schema.sliders.id });
  ids.slider = slider?.id ?? '';
  await h.db
    .insert(schema.sliderSlides)
    .values({ sliderId: ids.slider, position: 0, mediaId: ids.pubblico ?? null, heading: 'Uno' });

  const documents = await h.db
    .insert(schema.documents)
    .values([
      { slug: 'modulo-pubblico', title: 'Modulo pubblico', mediaId: ids.pubblico ?? '' },
      {
        slug: 'modulo-riservato',
        title: 'Modulo riservato',
        mediaId: ids.pubblico ?? '',
        isPrivate: true,
      },
      { slug: 'modulo-file-riservato', title: 'File riservato', mediaId: ids.riservato ?? '' },
    ])
    .returning({ id: schema.documents.id, slug: schema.documents.slug });
  for (const d of documents) ids[d.slug] = d.id;

  await content('pagina', {
    path: '/pagina-sintetica/',
    status: 'published',
    text: 'Testo di una pagina inventata. '.repeat(10),
    blocks: [
      { type: 'image', id: 'b1', props: { mediaId: ids.pubblico } },
      { type: 'image', id: 'b2', props: { mediaId: ids.riservato } },
      { type: 'slider', id: 'b3', props: { sliderId: ids.slider } },
      { type: 'document', id: 'b4', props: { documentId: ids['modulo-pubblico'] } },
      { type: 'document', id: 'b5', props: { documentId: ids['modulo-riservato'] } },
      { type: 'document', id: 'b6', props: { documentId: ids['modulo-file-riservato'] } },
      {
        type: 'html',
        id: 'b7',
        props: { html: '<img src="/media/2026/01/citato-300x200.png" alt="">' },
      },
      {
        type: 'html',
        id: 'b8',
        props: { html: '<img src="/media/2026/01/citt%C3%A0-codificata.png" alt="">' },
      },
    ],
  });
  await content('home', {
    path: '/home-sintetica/',
    status: 'published',
    excerpt: 'Estratto della home.',
  });
  await content('bozza', { path: '/bozza-sintetica/', status: 'draft' });
  await content('ritirata', { path: '/ritirata-sintetica/', status: 'archived' });
  await content('nascosta', { path: '/nascosta-ai-motori/', status: 'published' });
  await h.db
    .insert(schema.contentSeo)
    .values({ contentId: ids.nascosta ?? '', robotsNoindex: true });

  const [term] = await h.db
    .insert(schema.terms)
    .values({ taxonomy: 'category', slug: 'news', name: 'Notizie', path: '/category/news/' })
    .returning({ id: schema.terms.id });
  ids.news = term?.id ?? '';
  for (const [n, status] of (['published', 'published', 'draft'] as const).entries()) {
    const id = await content(`articolo${n}`, {
      path: `/articolo-${n}/`,
      status,
      type: 'post',
      publishedAt: `2026-03-0${n + 1}T10:00:00Z`,
      text: 'uno  due tre\nquattro cinque',
    });
    await h.db.insert(schema.contentTerms).values({ contentId: id, termId: ids.news });
  }

  const [formAttiva] = await h.db
    .insert(schema.forms)
    .values({
      slug: 'contatti-sintetico',
      title: 'Contatti',
      definition: {
        fields: [
          { id: 'nome', type: 'text', label: 'Nome', required: true, order: 0, options: {} },
          {
            id: 'quota',
            type: 'payment-single',
            label: 'Quota',
            required: true,
            order: 1,
            options: { amount: '35' },
          },
        ],
      },
      confirmationMessage: 'Grazie, ti risponderemo presto.',
      requiresPayment: true,
    })
    .returning({ id: schema.forms.id });
  ids.form = formAttiva?.id ?? '';
  const [formBozza] = await h.db
    .insert(schema.forms)
    .values({ slug: 'disattivo-sintetico', title: 'Disattivo', definition: {}, isActive: false })
    .returning({ id: schema.forms.id });
  ids.formDisattivo = formBozza?.id ?? '';

  await content('conBlocchiRuntime', {
    path: '/con-blocchi-runtime/',
    status: 'published',
    blocks: [
      { type: 'form', id: 'bf1', props: { formId: ids.form } },
      { type: 'form', id: 'bf2', props: { formId: ids.formDisattivo } },
      {
        type: 'post_list',
        id: 'bl1',
        props: { termIds: [ids.news], offset: 1, order: 'date_desc', excerptWords: 3 },
      },
    ],
  });

  await h.db.insert(schema.seoTemplates).values([
    { scope: 'page', titleTemplate: '{title} - {site_title}' },
    { scope: 'home', titleTemplate: '{title} - {site_title}' },
    { scope: 'category', titleTemplate: '{term_title} - {site_title}' },
  ]);

  await h.db.insert(schema.settings).values([
    { key: 'site.title', value: 'Sito sintetico', label: 'Titolo' },
    { key: 'site.home_content_id', value: ids.home ?? '', label: 'Pagina iniziale' },
    { key: 'analytics.ga4_measurement_id', value: 'G-SINTETICO', label: 'Analisi' },
    { key: 'segreto.sintetico', value: 'non-deve-uscire', label: 'Segreto', isSecret: true },
  ]);

  await h.db.insert(schema.redirects).values([
    { sourcePath: '/vecchio/', targetPath: '/pagina-sintetica/', origin: 'migration' },
    { sourcePath: '/spento/', targetPath: '/pagina-sintetica/', isActive: false },
    {
      sourcePath: '/wp-content/uploads/',
      targetPath: '/media/',
      kind: 'prefix',
      origin: 'migration',
    },
  ]);

  const [menu] = await h.db
    .insert(schema.menus)
    .values({ key: 'menu-principale', label: 'Menu' })
    .returning({ id: schema.menus.id });
  const item = async (values: Partial<typeof schema.menuItems.$inferInsert>) => {
    const [row] = await h.db
      .insert(schema.menuItems)
      .values({ menuId: menu?.id ?? '', kind: 'custom', url: '/x/', label: 'Voce', ...values })
      .returning({ id: schema.menuItems.id });
    return row?.id ?? '';
  };
  const padre = await item({
    kind: 'content',
    url: null,
    contentId: ids.pagina,
    label: 'Pagina',
    position: 0,
  });
  await item({ parentId: padre, label: 'Figlia pubblica', position: 0 });
  await item({ label: 'Solo per chi accede', visibility: 'authenticated', position: 1 });
  await item({
    label: 'Solo per un ruolo',
    visibility: 'roles',
    visibleToRoles: ['editor'],
    position: 2,
  });
  const nascosto = await item({ label: 'Nascosta', visibility: 'hidden', position: 3 });
  await item({ parentId: nascosto, label: 'Figlia di una nascosta', position: 0 });
  await item({
    kind: 'content',
    url: null,
    contentId: ids.bozza,
    label: 'Verso una bozza',
    position: 4,
  });
  await item({ kind: 'term', url: null, termId: ids.news, label: 'Notizie', position: 5 });
  await item({ kind: 'content', url: null, contentId: ids.home, label: '', position: 6 });
});

afterAll(async () => {
  await h?.teardown();
});

const get = (url: string) => h.app.inject({ method: 'GET', url });

describe('contenuti', () => {
  it('restituisce una pagina pubblicata con media, carosello, documenti e SEO risolto', async () => {
    const response = await get('/public/content?path=/pagina-sintetica/');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.content.title).toBe('Titolo pagina');
    // DR-139: il layout esce con il contenuto; qui il predefinito del tema.
    expect(body.content.pageLayout).toBe('right_sidebar');
    expect(body.seo.title).toBe('Titolo pagina - Sito sintetico');
    expect(body.seo.robots).toBe('max-image-preview:large');
    expect(body.seo.description).toMatch(/^Testo di una pagina inventata\./);
    expect(body.seo.description.length).toBeLessThanOrEqual(161);
    expect(body.media[ids.pubblico ?? '']?.variants).toEqual([
      { publicPath: '/media/2026/01/pubblico-10x5.png', width: 10, height: 5 },
    ]);
    expect(body.sliders[ids.slider ?? '']?.slides).toHaveLength(1);
    expect(Object.keys(body.documents)).toEqual([ids['modulo-pubblico']]);
  });

  it('risolve il form attivo citato da un blocco «form», escluso il campo di pagamento', async () => {
    const body = (await get('/public/content?path=/con-blocchi-runtime/')).json();
    const form = body.forms[ids.form ?? ''];
    expect(form.slug).toBe('contatti-sintetico');
    expect(form.fields.map((f: { type: string }) => f.type)).toEqual(['text']);
    expect(form.payment).toEqual({ amount: 35, url: null });
  });

  it('risolve l’elenco di un blocco «post_list», con l’«offset» del blocco (DR-116)', async () => {
    const body = (await get('/public/content?path=/con-blocchi-runtime/')).json();
    expect(body.postLists.bl1.map((p: { path: string }) => p.path)).toEqual(['/articolo-0/']);
  });

  it('l’estratto di un «post_list» sono le prime N parole del testo, come wp_trim_words (1E-W6)', async () => {
    const body = (await get('/public/content?path=/con-blocchi-runtime/')).json();
    expect(body.postLists.bl1[0].summary).toBe('uno due tre');
    expect(body.postLists.bl1[0].summaryTruncated).toBe(true);
  });

  it('la pagina iniziale si serve a «/», con il suo ambito SEO e l’indirizzo canonico «/»', async () => {
    const body = (await get('/public/content?path=/')).json();
    expect(body.content.id).toBe(ids.home);
    expect(body.seo.ogType).toBe('website');
    expect(body.seo.canonicalPath).toBe('/');
    expect(body.seo.description).toBe('Estratto della home.');
  });

  it('il percorso proprio della pagina iniziale non è un contenuto: risponde 301 verso «/»', async () => {
    expect((await get('/public/content?path=/home-sintetica/')).statusCode).toBe(404);
    expect((await get('/public/redirect?path=/home-sintetica/')).json()).toEqual({
      targetPath: '/',
      statusCode: 301,
    });
  });

  it('prova negativa: bozze, contenuti ritirati e percorsi inesistenti non esistono', async () => {
    for (const path of ['/bozza-sintetica/', '/ritirata-sintetica/', '/non-esiste/']) {
      expect((await get(`/public/content?path=${path}`)).statusCode).toBe(404);
    }
  });

  it('prova negativa: un media riservato citato dai blocchi non compare', async () => {
    const body = (await get('/public/content?path=/pagina-sintetica/')).json();
    expect(body.media[ids.riservato ?? '']).toBeUndefined();
  });

  it('prova negativa: documenti riservati, o con il file riservato, non compaiono', async () => {
    const body = (await get('/public/content?path=/pagina-sintetica/')).json();
    expect(body.documents[ids['modulo-riservato'] ?? '']).toBeUndefined();
    expect(body.documents[ids['modulo-file-riservato'] ?? '']).toBeUndefined();
  });

  it('rifiuta un percorso che non è un percorso', async () => {
    expect((await get('/public/content?path=pagina')).statusCode).toBe(400);
  });

  it('prova negativa: un form disattivato citato da un blocco non compare', async () => {
    const body = (await get('/public/content?path=/con-blocchi-runtime/')).json();
    expect(body.forms[ids.formDisattivo ?? '']).toBeUndefined();
  });
});

describe('menu', () => {
  it('a chi non ha fatto accesso mostra solo le voci pubbliche, con i loro indirizzi', async () => {
    const body = (await get('/public/menus/menu-principale')).json();
    expect(body.items.map((i: { label: string }) => i.label)).toEqual([
      'Pagina',
      'Notizie',
      // Senza titolo, come in WordPress, prende quello del contenuto; punta a «/».
      'Titolo home',
    ]);
    expect(body.items[2].href).toBe('/');
    expect(body.items[0].href).toBe('/pagina-sintetica/');
    expect(body.items[0].children.map((i: { label: string }) => i.label)).toEqual([
      'Figlia pubblica',
    ]);
    expect(body.items[1].href).toBe('/category/news/');
  });

  it('prova negativa: voci per chi accede, per ruolo, nascoste, figlie di nascoste, verso bozze', async () => {
    const text = (await get('/public/menus/menu-principale')).body;
    for (const label of [
      'Solo per chi accede',
      'Solo per un ruolo',
      'Nascosta',
      'Figlia di una nascosta',
      'Verso una bozza',
    ]) {
      expect(text).not.toContain(label);
    }
    expect((await get('/public/menus/inesistente')).statusCode).toBe(404);
  });
});

describe('impostazioni', () => {
  it('il logo esce con il suo indirizzo, se il media è pubblico (DR-117)', async () => {
    await h.db
      .insert(schema.settings)
      .values({ key: 'site.logo_media_id', value: ids.pubblico ?? '', label: 'Logo' });
    const body = (await get('/public/settings')).json();
    expect(body['site.logo_path']).toBe('/media/2026/01/pubblico.png');
    await h.db
      .update(schema.settings)
      .set({ value: ids.riservato ?? '' })
      .where(eq(schema.settings.key, 'site.logo_media_id'));
    expect((await get('/public/settings')).json()['site.logo_path']).toBeUndefined();
    await h.db.delete(schema.settings).where(eq(schema.settings.key, 'site.logo_media_id'));
  });

  it('prova negativa: escono solo quelle dell’elenco, mai analisi né segreti', async () => {
    const body = (await get('/public/settings')).json();
    // Nemmeno l'identificativo della pagina iniziale: serve al servizio, non al sito.
    expect(body).toEqual({ 'site.title': 'Sito sintetico' });
  });
});

describe('redirect', () => {
  it('una regola esatta attiva', async () => {
    const body = (await get('/public/redirect?path=/vecchio/')).json();
    expect(body).toEqual({ targetPath: '/pagina-sintetica/', statusCode: 301 });
  });

  it('il prefisso dei vecchi percorsi dei media porta con sé il resto del percorso', async () => {
    const body = (await get('/public/redirect?path=/wp-content/uploads/2017/09/logo.png')).json();
    expect(body).toEqual({ targetPath: '/media/2017/09/logo.png', statusCode: 301 });
  });

  it('prova negativa: un prefisso verso un altro dominio non porta con sé il percorso', async () => {
    await h.db.insert(schema.redirects).values({
      sourcePath: '/esterno/',
      targetPath: 'https://esempio.invalid/',
      kind: 'prefix',
    });
    expect((await get('/public/redirect?path=/esterno/qualcosa')).statusCode).toBe(404);
  });

  it('un contenuto pubblicato vince su una regola con lo stesso percorso, come in WordPress', async () => {
    await h.db.insert(schema.redirects).values({
      sourcePath: '/pagina-sintetica/',
      targetPath: '/media/2026/01/pubblico.png',
      origin: 'migration',
    });
    expect((await get('/public/redirect?path=/pagina-sintetica/')).statusCode).toBe(404);
  });

  it('prova negativa: una regola spenta, o nessuna regola, non reindirizza', async () => {
    expect((await get('/public/redirect?path=/spento/')).statusCode).toBe(404);
    expect((await get('/public/redirect?path=/pagina-sintetica/')).statusCode).toBe(404);
  });
});

describe('articoli e tassonomie', () => {
  it('prova negativa: elenca solo gli articoli pubblicati, i più recenti prima', async () => {
    const body = (await get(`/public/posts?termIds=${ids.news}`)).json();
    expect(body.items.map((i: { path: string }) => i.path)).toEqual([
      '/articolo-1/',
      '/articolo-0/',
    ]);
    expect(body.meta.total).toBe(2);
  });

  it('rifiuta una pagina oltre il tetto', async () => {
    expect((await get('/public/posts?page=201')).statusCode).toBe(400);
  });

  it('impagina', async () => {
    const body = (await get('/public/posts?perPage=1&page=2')).json();
    expect(body.items.map((i: { path: string }) => i.path)).toEqual(['/articolo-0/']);
  });

  it('salta i primi articoli con «offset», oltre alla pagina (DR-116)', async () => {
    const body = (await get(`/public/posts?termIds=${ids.news}&offset=1`)).json();
    expect(body.items.map((i: { path: string }) => i.path)).toEqual(['/articolo-0/']);
    // Il totale non cambia: «offset» sposta solo dove comincia l'elenco.
    expect(body.meta.total).toBe(2);
  });

  it('una categoria per percorso, con il titolo dal template', async () => {
    const body = (await get('/public/terms?path=/category/news/')).json();
    expect(body.seo.title).toBe('Notizie - Sito sintetico');
    expect((await get('/public/terms?path=/category/nessuna/')).statusCode).toBe(404);
  });
});

describe('documenti', () => {
  it('un documento pubblico si legge', async () => {
    const response = await get('/public/documents/modulo-pubblico');
    expect(response.statusCode).toBe(200);
    expect(response.json().media[ids.pubblico ?? '']).toBeDefined();
  });

  it('prova negativa: riservato, o con il file riservato, risponde 404', async () => {
    expect((await get('/public/documents/modulo-riservato')).statusCode).toBe(404);
    expect((await get('/public/documents/modulo-file-riservato')).statusCode).toBe(404);
  });
});

describe('mappa del sito', () => {
  it('prova negativa: solo contenuti pubblicati, esclusi quelli fuori dai motori', async () => {
    const paths = (await get('/public/sitemap'))
      .json()
      .entries.map((e: { path: string }) => e.path);
    expect(paths).toContain('/pagina-sintetica/');
    expect(paths).toContain('/category/news/');
    expect(paths).toContain('/');
    expect(paths).not.toContain('/home-sintetica/');
    for (const escluso of [
      '/bozza-sintetica/',
      '/ritirata-sintetica/',
      '/nascosta-ai-motori/',
      '/articolo-2/',
    ]) {
      expect(paths).not.toContain(escluso);
    }
  });
});

describe('file dei media a /media/…', () => {
  it('serve un originale e una dimensione derivata, con tipo, impronta e protezioni', async () => {
    for (const path of ['/media/2026/01/pubblico.png', '/media/2026/01/pubblico-10x5.png']) {
      const response = await get(path);
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers.etag).toMatch(/^"[0-9a-f]+"$/);
      expect(response.rawPayload.equals(PNG)).toBe(true);
    }
  });

  it('un nome con lettere accentate, chiesto codificato come fa il browser', async () => {
    expect((await get('/media/2026/01/genitorialit%C3%A0.png')).statusCode).toBe(200);
  });

  it('risponde 304 a una copia ancora valida, e a HEAD senza corpo', async () => {
    const first = await get('/media/2026/01/pubblico.png');
    const again = await h.app.inject({
      method: 'GET',
      url: '/media/2026/01/pubblico.png',
      headers: { 'if-none-match': String(first.headers.etag) },
    });
    expect(again.statusCode).toBe(304);
    const head = await h.app.inject({ method: 'HEAD', url: '/media/2026/01/pubblico.png' });
    expect(head.statusCode).toBe(200);
    expect(head.headers['content-length']).toBe(String(PNG.length));
  });

  it('prova negativa: un media riservato non si serve, anche se il file esiste', async () => {
    expect(h.store.objects.has('media-private/2026/01/riservato.png')).toBe(true);
    expect((await get('/media/2026/01/riservato.png')).statusCode).toBe(404);
    expect((await get('/media/2026/01/inesistente.png')).statusCode).toBe(404);
  });

  it('un media a registro ma assente dal bucket risponde 404, non 500', async () => {
    h.store.objects.delete('media-public/2026/01/libero.png');
    const response = await get('/media/2026/01/libero.png');
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('le rotte della redazione su /media restano protette', async () => {
    expect((await get(`/media/${ids.pubblico}`)).statusCode).toBe(401);
  });
});

describe('eliminazione di un media citato per indirizzo (DR-109)', () => {
  it('un media citato per indirizzo di una sua dimensione derivata non si elimina', async () => {
    const signed = await signIn(h);
    const response = await h.app.inject({
      method: 'DELETE',
      url: `/media/${ids.citatoPerIndirizzo}`,
      headers: signed.writeHeaders,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.message).toContain('Titolo pagina');
  });

  it('un media citato con l’indirizzo codificato non si elimina', async () => {
    const signed = await signIn(h);
    const response = await h.app.inject({
      method: 'DELETE',
      url: `/media/${ids.citatoCodificato}`,
      headers: signed.writeHeaders,
    });
    expect(response.statusCode).toBe(409);
  });

  it('un media che nessuno cita si elimina', async () => {
    const signed = await signIn(h);
    const response = await h.app.inject({
      method: 'DELETE',
      url: `/media/${ids.libero}`,
      headers: signed.writeHeaders,
    });
    expect(response.statusCode).toBe(204);
  });
});
