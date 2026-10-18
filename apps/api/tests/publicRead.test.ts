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
    gutterWidth?: number;
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
      gutterWidth: values.gutterWidth ?? null,
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
  await content('spaziata', {
    path: '/spaziatura-sintetica/',
    status: 'published',
    gutterWidth: 3,
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
  it('restituisce la spaziatura propria della pagina (DR-149)', async () => {
    const response = await get('/public/content?path=/spaziatura-sintetica/');
    expect(response.statusCode).toBe(200);
    expect(response.json().content.gutterWidth).toBe(3);
  });

  it('restituisce una pagina pubblicata con media, carosello, documenti e SEO risolto', async () => {
    const response = await get('/public/content?path=/pagina-sintetica/');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.content.title).toBe('Titolo pagina');
    // DR-139: il layout esce con il contenuto; qui il predefinito del tema.
    expect(body.content.pageLayout).toBe('right_sidebar');
    // DR-149: senza valore proprio, la spaziatura del tema.
    expect(body.content.gutterWidth).toBeNull();
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

  it('l’inizio del testo per l’estratto viene dalla forma della sorgente, se l’import l’ha scritta (D71)', async () => {
    const before = (await get(`/public/posts?termIds=${ids.news}`)).json();
    const textOf = (body: { items: { path: string; textStart: string }[] }, path: string) =>
      body.items.find((i) => i.path === path)?.textStart;
    expect(textOf(before, '/articolo-1/')).toBe('uno due tre quattro cinque');

    await h.db
      .update(schema.contents)
      .set({ summarySource: 'L&#8217;inizio  sintetico' })
      .where(eq(schema.contents.id, ids.articolo1 ?? ''));
    try {
      const after = (await get(`/public/posts?termIds=${ids.news}`)).json();
      expect(textOf(after, '/articolo-1/')).toBe('L&#8217;inizio sintetico');
      expect(textOf(after, '/articolo-0/')).toBe('uno due tre quattro cinque');
    } finally {
      await h.db
        .update(schema.contents)
        .set({ summarySource: null })
        .where(eq(schema.contents.id, ids.articolo1 ?? ''));
    }
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

describe('metadati, documenti e mappa del sito della T7 (DR-179…193)', () => {
  const longText = `Inizio ${'parola '.repeat(40)}fine`;

  beforeAll(async () => {
    await content('conDescription', {
      path: '/con-description/',
      status: 'published',
      excerpt: 'Estratto copiato da un’altra pagina',
      text: 'Testo “tipografico” della pagina',
    });
    await h.db
      .update(schema.contents)
      .set({
        descriptionSource: `Il corso "Prova" dell'anno 🎉`,
        modifiedAt: new Date('2021-03-04T10:12:13Z'),
      })
      .where(eq(schema.contents.id, ids.conDescription ?? ''));
    await content('descriptionLunga', { path: '/description-lunga/', status: 'published' });
    await h.db
      .update(schema.contents)
      .set({ descriptionSource: longText })
      .where(eq(schema.contents.id, ids.descriptionLunga ?? ''));
    await content('paginaCms', {
      path: '/pagina-cms/',
      status: 'published',
      excerpt: 'Estratto della pagina',
      text: 'Testo della pagina scritto dal CMS',
    });
    await content('articoloCms', {
      path: '/articolo-cms/',
      status: 'published',
      type: 'post',
      excerpt: 'Estratto dell’articolo',
      text: 'Testo dell’articolo',
    });
    await content('conVariabili', { path: '/con-variabili/', status: 'published' });
    await h.db
      .insert(schema.contentSeo)
      .values({ contentId: ids.conVariabili ?? '', title: '{title} - {site_title}' });
    await h.db
      .insert(schema.seoTemplates)
      .values({ scope: 'post', titleTemplate: '{title} - {site_title}' });

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
          slug: 'categoria-vuota',
          name: 'Categoria senza documenti pubblici',
          path: '/download-category/categoria-vuota/',
        },
        {
          taxonomy: 'cuar_private_file_category',
          slug: 'moduli-sintetici',
          name: 'File riservati sintetici',
          path: '/cuar_private_file_category/moduli-sintetici/',
        },
      ])
      .returning({ id: schema.terms.id, slug: schema.terms.slug, taxonomy: schema.terms.taxonomy });
    for (const t of terms) ids[`${t.taxonomy}:${t.slug}`] = t.id;
    const moduli = ids['wpdmcategory:moduli-sintetici'] ?? '';
    const vuota = ids['wpdmcategory:categoria-vuota'] ?? '';
    const riservati = ids['cuar_private_file_category:moduli-sintetici'] ?? '';

    const docs = await h.db
      .insert(schema.documents)
      .values([
        {
          slug: 'modulo-vecchio',
          title: 'A modulo vecchio',
          mediaId: ids.pubblico ?? '',
          publishedAt: new Date('2022-01-01T10:00:00Z'),
        },
        {
          slug: 'modulo-nuovo',
          title: 'B modulo nuovo',
          mediaId: ids.pubblico ?? '',
          publishedAt: new Date('2022-02-01T10:00:00Z'),
        },
        {
          slug: 'modulo-categoria-riservato',
          title: 'Modulo riservato in categoria',
          mediaId: ids.pubblico ?? '',
          isPrivate: true,
        },
      ])
      .returning({ id: schema.documents.id, slug: schema.documents.slug });
    for (const d of docs) ids[d.slug] = d.id;
    await h.db.insert(schema.documentTerms).values([
      { documentId: ids['modulo-vecchio'] ?? '', termId: moduli },
      { documentId: ids['modulo-nuovo'] ?? '', termId: moduli },
      { documentId: ids['modulo-categoria-riservato'] ?? '', termId: moduli },
      { documentId: ids['modulo-file-riservato'] ?? '', termId: moduli },
      { documentId: ids['modulo-riservato'] ?? '', termId: vuota },
      { documentId: ids['modulo-vecchio'] ?? '', termId: riservati },
    ]);
  });

  describe('description dei metadati (DR-179, DR-180)', () => {
    it('vale la description calcolata all’import, con apici dritti ed emoji, anche per og:description', async () => {
      const body = (await get('/public/content?path=/con-description/')).json();
      expect(body.seo.description).toBe(`Il corso "Prova" dell'anno 🎉`);
      expect(body.seo.ogDescription).toBe(`Il corso "Prova" dell'anno 🎉`);
      // Il titolo non si tocca (DR-179).
      expect(body.seo.title).toBe('Titolo conDescription - Sito sintetico');
    });

    it('la description lunga si taglia a 160 con «…», come prima', async () => {
      const body = (await get('/public/content?path=/description-lunga/')).json();
      expect(body.seo.description.endsWith('…')).toBe(true);
      expect(body.seo.description.length).toBeLessThanOrEqual(161);
      expect(longText.startsWith(body.seo.description.slice(0, -1))).toBe(true);
    });

    it('senza description dell’import: pagina dal testo, non dall’estratto', async () => {
      const body = (await get('/public/content?path=/pagina-cms/')).json();
      expect(body.seo.description).toBe('Testo della pagina scritto dal CMS');
    });

    it('senza description dell’import: articolo dall’estratto', async () => {
      const body = (await get('/public/content?path=/articolo-cms/')).json();
      expect(body.seo.description).toBe('Estratto dell’articolo');
    });

    it('pagina senza testo: l’estratto', async () => {
      const body = (await get('/public/content?path=/')).json();
      expect(body.seo.description).toBe('Estratto della home.');
    });
  });

  describe('data di modifica (DR-186)', () => {
    it('esce come modifiedAt in ISO, o la data di aggiornamento se manca', async () => {
      const withDate = (await get('/public/content?path=/con-description/')).json();
      expect(withDate.content.modifiedAt).toBe('2021-03-04T10:12:13.000Z');
      const without = (await get('/public/content?path=/pagina-cms/')).json();
      expect(without.content.modifiedAt).toBe(without.content.updatedAt);
    });

    it('è anche la data della mappa del sito, non quella dell’import', async () => {
      const entries: { path: string; updatedAt: string }[] = (await get('/public/sitemap')).json()
        .entries;
      expect(entries.find((e) => e.path === '/con-description/')?.updatedAt).toBe(
        '2021-03-04T10:12:13.000Z',
      );
    });
  });

  describe('title di sovrascrittura (DR-174, DR-191)', () => {
    it('i segnaposto del title importato si riempiono come quelli del modello', async () => {
      const body = (await get('/public/content?path=/con-variabili/')).json();
      expect(body.seo.title).toBe('Titolo conVariabili - Sito sintetico');
    });
  });

  describe('impostazioni dell’organizzazione (DR-185)', () => {
    it('indirizzo, telefono e profili social sono pubblici', async () => {
      await h.db.insert(schema.settings).values([
        { key: 'contact.address', value: 'Via Sintetica 1', label: 'Indirizzo' },
        { key: 'contact.phone', value: '+39 000 0000000', label: 'Telefono' },
        {
          key: 'social.profiles',
          value: ['https://social.example.invalid/centro'],
          label: 'Social',
        },
      ]);
      const body = (await get('/public/settings')).json();
      expect(body['contact.address']).toBe('Via Sintetica 1');
      expect(body['contact.phone']).toBe('+39 000 0000000');
      expect(body['social.profiles']).toEqual(['https://social.example.invalid/centro']);
      expect(body['analytics.ga4_measurement_id']).toBeUndefined();
    });
  });

  describe('categoria dei download (DR-181, DR-193)', () => {
    it('una categoria dei download si risolve per percorso', async () => {
      const response = await get('/public/terms?path=/download-category/moduli-sintetici/');
      expect(response.statusCode).toBe(200);
      expect(response.json().term.taxonomy).toBe('wpdmcategory');
    });

    it('prova negativa: la categoria dei file riservati non si risolve', async () => {
      const response = await get(
        '/public/terms?path=/cuar_private_file_category/moduli-sintetici/',
      );
      expect(response.statusCode).toBe(404);
    });

    it('elenca solo i documenti pubblici della categoria, i più recenti prima', async () => {
      const response = await get(
        `/public/documents?termId=${ids['wpdmcategory:moduli-sintetici']}`,
      );
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items.map((d: { slug: string }) => d.slug)).toEqual([
        'modulo-nuovo',
        'modulo-vecchio',
      ]);
      expect(body.media[ids.pubblico ?? '']).toBeDefined();
    });

    it('prova negativa: riservati, con file riservato, categorie riservate o inesistenti', async () => {
      const text = (await get(`/public/documents?termId=${ids['wpdmcategory:moduli-sintetici']}`))
        .body;
      expect(text).not.toContain('modulo-categoria-riservato');
      expect(text).not.toContain('modulo-file-riservato');
      // Una categoria senza documenti pubblici non esiste per il sito, come nella sitemap.
      const vuota = await get(`/public/documents?termId=${ids['wpdmcategory:categoria-vuota']}`);
      expect(vuota.statusCode).toBe(404);
      expect((await get('/public/terms?path=/download-category/categoria-vuota/')).statusCode).toBe(
        404,
      );
      const riservata = await get(
        `/public/documents?termId=${ids['cuar_private_file_category:moduli-sintetici']}`,
      );
      expect(riservata.statusCode).toBe(404);
      expect((await get('/public/documents?termId=non-un-uuid')).statusCode).toBe(400);
      expect(
        (await get('/public/documents?termId=00000000-0000-4000-8000-000000000000')).statusCode,
      ).toBe(404);
    });

    it('il documento porta con sé le sue categorie pubbliche, per le briciole', async () => {
      const body = (await get('/public/documents/modulo-vecchio')).json();
      expect(body.terms.map((t: { path: string }) => t.path)).toEqual([
        '/download-category/moduli-sintetici/',
      ]);
    });
  });

  describe('mappa del sito con i documenti (DR-177, DR-181)', () => {
    it('elenca i documenti pubblici e le categorie dei download che ne hanno', async () => {
      const entries: { path: string; kind: string; updatedAt: string }[] = (
        await get('/public/sitemap')
      ).json().entries;
      const byPath = new Map(entries.map((e) => [e.path, e]));
      expect(byPath.get('/download/modulo-nuovo/')).toEqual({
        path: '/download/modulo-nuovo/',
        kind: 'document',
        updatedAt: '2022-02-01T10:00:00.000Z',
      });
      expect(byPath.get('/download/modulo-pubblico/')?.kind).toBe('document');
      expect(byPath.get('/download-category/moduli-sintetici/')?.kind).toBe('download_category');
    });

    it('prova negativa: documenti riservati, categorie senza pubblici e file riservati mai', async () => {
      const paths = (await get('/public/sitemap'))
        .json()
        .entries.map((e: { path: string }) => e.path);
      for (const escluso of [
        '/download/modulo-riservato/',
        '/download/modulo-file-riservato/',
        '/download/modulo-categoria-riservato/',
        '/download-category/categoria-vuota/',
        '/cuar_private_file_category/moduli-sintetici/',
      ]) {
        expect(paths).not.toContain(escluso);
      }
    });
  });

  describe('richieste a intervalli sui media (DR-189)', () => {
    const range = (value: string, extra: Record<string, string> = {}) =>
      h.app.inject({
        method: 'GET',
        url: '/media/2026/01/pubblico.png',
        headers: { range: value, ...extra },
      });

    it('senza Range: 200 intero e Accept-Ranges', async () => {
      const response = await get('/media/2026/01/pubblico.png');
      expect(response.statusCode).toBe(200);
      expect(response.headers['accept-ranges']).toBe('bytes');
    });

    it('bytes=a-b, a- e -n rispondono 206 con la parte giusta', async () => {
      const cases: [string, number, number][] = [
        ['bytes=1-3', 1, 3],
        ['bytes=2-', 2, PNG.length - 1],
        ['bytes=-3', PNG.length - 3, PNG.length - 1],
        ['bytes=4-999', 4, PNG.length - 1],
      ];
      for (const [header, start, end] of cases) {
        const response = await range(header);
        expect(response.statusCode).toBe(206);
        expect(response.headers['content-range']).toBe(`bytes ${start}-${end}/${PNG.length}`);
        expect(response.headers['content-length']).toBe(String(end - start + 1));
        expect(response.headers['accept-ranges']).toBe('bytes');
        expect(response.rawPayload.equals(PNG.subarray(start, end + 1))).toBe(true);
      }
    });

    it('un intervallo fuori dal file risponde 416 con la dimensione', async () => {
      const outside = [
        `bytes=${PNG.length}-`,
        'bytes=-0',
        `bytes=${PNG.length + 5}-${PNG.length + 9}`,
      ];
      for (const header of outside) {
        const response = await range(header);
        expect(response.statusCode).toBe(416);
        expect(response.headers['content-range']).toBe(`bytes */${PNG.length}`);
        expect(response.headers['accept-ranges']).toBe('bytes');
      }
    });

    it('Range malformato, di altra unità o con più intervalli: 200 intero', async () => {
      for (const header of ['bytes=3-1', 'items=0-1', 'bytes=0-1,3-4', 'bytes=abc']) {
        const response = await range(header);
        expect(response.statusCode).toBe(200);
        expect(response.rawPayload.equals(PNG)).toBe(true);
      }
    });

    it('If-Range con un’impronta diversa: 200 intero; con la stessa: 206', async () => {
      const etag = String((await get('/media/2026/01/pubblico.png')).headers.etag);
      expect((await range('bytes=0-1', { 'if-range': '"altra"' })).statusCode).toBe(200);
      expect((await range('bytes=0-1', { 'if-range': etag })).statusCode).toBe(206);
    });

    it('prova negativa: un media riservato resta 404 anche con Range', async () => {
      const response = await h.app.inject({
        method: 'GET',
        url: '/media/2026/01/riservato.png',
        headers: { range: 'bytes=0-1' },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
