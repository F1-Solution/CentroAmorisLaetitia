import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blockDocumentSchema } from '@amoris/blocks';
import type * as ApiModule from '../src/lib/api';
import type * as NextServer from 'next/server';
import type { PostPage, PublicContent, PublicDocument } from '../src/lib/api';
import {
  ArchiveView,
  ContentView,
  DocumentView,
  DownloadCategoryView,
} from '../src/components/Views';
import { renderFeed } from '../src/lib/feed';
import { buildGraph, siteFromSettings } from '../src/lib/structuredData';
import { siteDatesFrom } from '../src/lib/wpDate';

/*
 * DR-270: il sito applica «Lingua del sito», «Fuso orario» e «Formato data» solo
 * dove li usava la sorgente.
 *
 * - `date_format` (WordPress): «Data di creazione» e «Ultimo aggiornamento» della
 *   scheda di Download Manager (`get_the_date('')`, `date_i18n(get_option('date_format'))`)
 *   e la data dell'elenco Category Posts (`preset_date_format = sitedate`).
 * - `divi_date_format` = «j M Y» (opzione del tema, non esposta dall'area): la riga
 *   dei metadati di articoli, archivi, ricerca, scheda e categoria dei download.
 *   Il formato resta quello del tema; lingua e fuso sono quelli del sito, perché
 *   WordPress li applica a ogni data (`date_i18n`).
 * - `WPLANG`: `lang`, `og:locale`, lingua del feed e `inLanguage` dei dati strutturati.
 *
 * Dati sintetici.
 */

const ITALIANO = siteDatesFrom({
  'site.locale': 'it_IT',
  'site.timezone': 'Europe/Rome',
  'site.date_format': 'j F Y',
});
const NUMERICO = siteDatesFrom({
  'site.locale': 'it_IT',
  'site.timezone': 'Europe/Rome',
  'site.date_format': 'd/m/Y',
});
const INGLESE = siteDatesFrom({
  'site.locale': 'en_US',
  'site.timezone': 'UTC',
  'site.date_format': 'F j, Y',
});

const media = {
  'm-1': {
    id: 'm-1',
    publicPath: '/media/modulo-sintetico.pdf',
    mimeType: 'application/pdf',
    width: null,
    height: null,
    title: null,
    altText: null,
    caption: null,
    variants: [],
  },
};

/** Pubblicato alle 23:30 UTC del 5 aprile: a Roma è già il 6. */
const documento: PublicDocument = {
  id: 'doc-1',
  slug: 'modulo-sintetico',
  title: 'Modulo sintetico',
  description: null,
  mediaId: 'm-1',
  updatedAt: '2026-10-16T09:00:00Z',
  publishedAt: '2022-04-05T23:30:00Z',
  modifiedAt: null,
  byteSize: 1024,
};

const badge = (html: string, etichetta: string) =>
  new RegExp(`${etichetta}\\s*(<!-- -->)?\\s*<span class="badge">([^<]*)</span>`).exec(html)?.[2];
const meta = (html: string) =>
  [...html.matchAll(/<span class="published">([^<]*)<\/span>/g)].map((m) => m[1]);

describe('scheda del documento: «Formato data» nelle date di Download Manager', () => {
  it('con i valori di oggi resta «6 Aprile 2022» (Roma), e la riga del tema «6 Apr 2022»', () => {
    const html = renderToStaticMarkup(
      <DocumentView document={documento} media={media} dates={ITALIANO} />,
    );
    expect(badge(html, 'Data di creazione')).toBe('6 Aprile 2022');
    expect(badge(html, 'Ultimo aggiornamento')).toBe('6 Aprile 2022');
    expect(meta(html)).toEqual(['6 Apr 2022']);
  });

  it('con «d/m/Y» cambiano le due date della scheda, non la riga del tema (divi_date_format)', () => {
    const html = renderToStaticMarkup(
      <DocumentView document={documento} media={media} dates={NUMERICO} />,
    );
    expect(badge(html, 'Data di creazione')).toBe('06/04/2022');
    expect(badge(html, 'Ultimo aggiornamento')).toBe('06/04/2022');
    expect(meta(html)).toEqual(['6 Apr 2022']);
  });

  it('lingua e fuso valgono per tutte le date: in inglese a UTC è ancora il 5 aprile', () => {
    const html = renderToStaticMarkup(
      <DocumentView document={documento} media={media} dates={INGLESE} />,
    );
    expect(badge(html, 'Data di creazione')).toBe('April 5, 2022');
    expect(meta(html)).toEqual(['5 Apr 2022']);
  });
});

describe('riga dei metadati del tema: formato fisso «j M Y», lingua e fuso del sito', () => {
  const posts: PostPage = {
    items: [
      {
        id: 'p-1',
        path: '/notizia-sintetica/',
        title: 'Notizia sintetica',
        excerpt: null,
        summary: null,
        textStart: 'Testo sintetico.',
        featuredMediaId: null,
        publishedAt: '2022-10-06T22:30:00Z',
      },
    ],
    media: {},
    meta: { total: 1, page: 1, perPage: 6 },
  };
  const term = {
    id: 't-1',
    taxonomy: 'category',
    slug: 'sintetica',
    name: 'Sintetica',
    path: '/category/sintetica/',
  };

  it('archivio: «7 Ott 2022» a Roma, «6 Oct 2022» in inglese a UTC; «d/m/Y» non lo tocca', () => {
    const resa = (dates: typeof ITALIANO) =>
      meta(renderToStaticMarkup(<ArchiveView term={term} posts={posts} page={1} dates={dates} />));
    expect(resa(ITALIANO)).toEqual(['7 Ott 2022']);
    expect(resa(NUMERICO)).toEqual(['7 Ott 2022']);
    expect(resa(INGLESE)).toEqual(['6 Oct 2022']);
  });

  it('categoria dei download: stessa riga del tema', () => {
    const html = renderToStaticMarkup(
      <DownloadCategoryView term={term} documents={[documento]} dates={INGLESE} />,
    );
    expect(meta(html)).toEqual(['5 Apr 2022']);
  });
});

describe('articolo ed elenco Category Posts', () => {
  const elenco = blockDocumentSchema.parse({
    schema: 1,
    blocks: [
      {
        type: 'post_list',
        id: 'b_00000000000a',
        props: { showThumbnail: false, showExcerpt: false, showDate: true },
        children: [],
      },
    ],
  });

  function articolo(dates: typeof ITALIANO): string {
    const data = {
      content: {
        id: '44444444-4444-4444-8444-444444444444',
        type: 'post',
        path: '/sintetico/',
        slug: 'sintetico',
        title: 'Titolo sintetico',
        showTitle: true,
        pageLayout: 'right_sidebar',
        excerpt: null,
        blocks: elenco,
        featuredMediaId: null,
        publishedAt: '2022-10-06T22:30:00Z',
        updatedAt: '2022-10-06T22:30:00Z',
      },
      seo: {},
      terms: [],
      media: {},
      sliders: {},
      forms: {},
      postLists: {
        b_00000000000a: [
          {
            id: 'p-2',
            path: '/altra-notizia/',
            title: 'Altra notizia',
            excerpt: null,
            summary: null,
            summaryTruncated: false,
            featuredMediaId: null,
            publishedAt: '2022-10-06T22:30:00Z',
          },
        ],
      },
      documents: {},
    } as unknown as PublicContent;
    return renderToStaticMarkup(<ContentView data={data} dates={dates} />);
  }

  const dataElenco = (html: string) =>
    /<span class="cat-post-date"> ([^<]*)<\/span>/.exec(html)?.[1];

  it('la data dell’articolo segue la riga del tema', () => {
    expect(meta(articolo(ITALIANO))).toEqual(['7 Ott 2022']);
    expect(meta(articolo(INGLESE))).toEqual(['6 Oct 2022']);
  });

  it('la data dell’elenco segue «Formato data» (preset «sitedate» del plugin)', () => {
    expect(dataElenco(articolo(ITALIANO))).toBe('7 Ottobre 2022');
    expect(dataElenco(articolo(NUMERICO))).toBe('07/10/2022');
    expect(dataElenco(articolo(INGLESE))).toBe('October 6, 2022');
  });
});

describe('lingua del sito fuori dalle date (WPLANG)', () => {
  it('feed: <language> in BCP 47', () => {
    const feed = (language: string) =>
      renderFeed({
        siteUrl: 'https://sito.example.invalid',
        title: 'Sito',
        description: '',
        path: '/',
        items: [],
        language,
      });
    expect(feed('it-IT')).toContain('<language>it-IT</language>');
    expect(feed('en-US')).toContain('<language>en-US</language>');
  });

  it('dati strutturati: inLanguage dalla lingua del sito, «it-IT» con i valori di oggi', () => {
    const lingue = (settings: Record<string, unknown>) =>
      buildGraph(siteFromSettings(settings, 'https://sito.example.invalid'), {
        kind: 'notFound',
        path: null,
      })['@graph'].flatMap((nodo) => ('inLanguage' in nodo ? [nodo.inLanguage] : []));
    expect(new Set(lingue({ 'site.locale': 'it_IT' }))).toEqual(new Set(['it-IT']));
    expect(new Set(lingue({ 'site.locale': 'en_US' }))).toEqual(new Set(['en-US']));
    expect(new Set(lingue({}))).toEqual(new Set(['it-IT']));
  });
});

const api = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getContent: vi.fn(),
  getTerm: vi.fn(),
  getPosts: vi.fn(),
  searchContents: vi.fn(),
}));

vi.mock('../src/lib/api', async (importOriginal) => {
  const reale = await importOriginal<typeof ApiModule>();
  return { ...reale, ...api };
});

vi.mock('next/server', async (importOriginal) => {
  const reale = await importOriginal<typeof NextServer>();
  return { ...reale, connection: vi.fn(async () => undefined) };
});

describe('lang dell’HTML e og:locale dalle impostazioni', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lang="it" con i valori di oggi, la sola lingua per un’altra', async () => {
    const { default: RootLayout } = await import('../src/app/layout');
    api.getSettings.mockResolvedValue({ 'site.locale': 'it_IT' });
    expect(renderToStaticMarkup(await RootLayout({ children: null }))).toContain('lang="it"');
    api.getSettings.mockResolvedValue({ 'site.locale': 'en_US' });
    expect(renderToStaticMarkup(await RootLayout({ children: null }))).toContain('lang="en"');
  });

  it('og:locale della pagina dalla lingua del sito', async () => {
    api.getSettings.mockResolvedValue({ 'site.title': 'Sito', 'site.locale': 'en_US' });
    api.getContent.mockResolvedValue({
      content: { id: 'c-1', type: 'page', title: 'Pagina' },
      seo: {
        title: 'Pagina - Sito',
        description: null,
        canonicalPath: '/pagina/',
        robots: '',
        ogTitle: 'Pagina',
        ogDescription: null,
        ogType: 'article',
        ogImagePath: null,
      },
    });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata({
      params: Promise.resolve({ percorso: ['pagina'] }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.openGraph).toMatchObject({ locale: 'en_US' });
  });
});

/*
 * «Articoli per pagina» non vale per archivi di categoria e ricerca: nella sorgente
 * li decidono le opzioni di Divi (`divi_catnum_posts = 6`, `divi_searchnum_posts = 5`).
 * Il sito chiede 6 articoli all'archivio e lascia alla ricerca il 5 del servizio.
 */
describe('archivi e ricerca non seguono «Articoli per pagina» (DR-270, giro 1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.getSettings.mockResolvedValue({ 'site.title': 'Sito', 'content.posts_per_page': 2 });
  });

  const parametri = (percorso: string[], searchParams: Record<string, string> = {}) => ({
    params: Promise.resolve({ percorso }),
    searchParams: Promise.resolve(searchParams),
  });

  it('l’archivio di categoria chiede 6 articoli, anche con «Articoli per pagina» a 2', async () => {
    api.getTerm.mockResolvedValue({
      term: {
        id: 't-1',
        taxonomy: 'category',
        slug: 'news',
        name: 'News',
        path: '/category/news/',
      },
      seo: { title: 'News - Sito', robots: '' },
    });
    api.getPosts.mockResolvedValue({
      items: [],
      media: {},
      meta: { total: 0, page: 1, perPage: 6 },
    });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    await generateMetadata(parametri(['category', 'news']));
    expect(api.getPosts).toHaveBeenCalledWith(['t-1'], 1, 6);
  });

  it('la ricerca non passa un numero: resta il 5 del servizio', async () => {
    api.searchContents.mockResolvedValue({
      items: [],
      media: {},
      meta: { total: 0, page: 1, perPage: 5 },
    });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    await generateMetadata(parametri([], { s: 'corso' }));
    expect(api.searchContents).toHaveBeenCalledWith('corso', 1);
  });
});
