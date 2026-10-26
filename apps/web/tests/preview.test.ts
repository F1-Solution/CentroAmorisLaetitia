import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';

/*
 * Wave 1G-W5, T6 (S15, S16, D148-A): `/anteprima/<id>/` si risolve dentro `[[...percorso]]`,
 * con la sessione di Redazione inoltrata solo all'API e il percorso del contenuto come percorso
 * corrente. L'API è sostituita da un doppio con dati sintetici.
 */

const api = vi.hoisted(() => ({
  getPreview: vi.fn(),
  getContent: vi.fn(),
  getTerm: vi.fn(),
  getPosts: vi.fn(),
  searchContents: vi.fn(),
  getDocument: vi.fn(),
  getDocuments: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock('../src/lib/api', async (importOriginal) => {
  const reale = await importOriginal<typeof ApiModule>();
  return { ...reale, ...api };
});

const jar = vi.hoisted(() => ({ values: {} as Record<string, string> }));
const asked = vi.hoisted(() => ({ names: [] as string[] }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      asked.names.push(name);
      const value = jar.values[name];
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

const ID = '3b1f6c1e-8d7a-4c53-9a0e-2f5d4e6a7b81';

const contenuto = (path: string, publicPath = path) => ({
  publicPath,
  content: {
    id: ID,
    type: 'page' as const,
    path,
    slug: 'chi-siamo',
    title: 'Pagina sintetica',
    showTitle: true,
    pageLayout: 'full_width' as const,
    gutterWidth: null,
    excerpt: null,
    blocks: { version: 1, blocks: [] },
    featuredMediaId: null,
    publishedAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    modifiedAt: '2026-10-02T10:00:00.000Z',
  },
  seo: {
    title: 'Pagina sintetica - Centro di prova',
    description: null,
    canonicalPath: path,
    robots: 'index, follow',
    ogTitle: 'Pagina sintetica',
    ogDescription: null,
    ogType: 'article',
    ogImagePath: null,
  },
  terms: [],
  media: {},
  sliders: {},
  forms: {},
  postLists: {},
  documents: {},
});

const parametri = (percorso: string[] | undefined) => ({
  params: Promise.resolve(percorso === undefined ? {} : { percorso }),
  searchParams: Promise.resolve({}),
});

/** Il segnale di `notFound()`: il digest che Next riconosce come 404. */
const NON_TROVATO = expect.objectContaining({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });

beforeEach(() => {
  vi.resetAllMocks();
  jar.values = {};
  asked.names = [];
  api.getSettings.mockResolvedValue({ 'site.title': 'Centro di prova' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('anteprima sul sito (S15)', () => {
  it('senza cookie risponde 404 senza chiamare l’API dell’anteprima', async () => {
    const { default: Page, generateMetadata } = await import('../src/app/[[...percorso]]/page');
    await expect(Page(parametri(['anteprima', ID]))).rejects.toEqual(NON_TROVATO);
    const meta = await generateMetadata(parametri(['anteprima', ID]));
    expect(meta.title).toBe('404 Non trovato | Centro di prova');
    expect(api.getPreview).not.toHaveBeenCalled();
    expect(api.getContent).not.toHaveBeenCalled();
  });

  it('con un identificativo che non è un UUID risponde 404 senza chiamare l’API', async () => {
    jar.values.amoris_sessione = 'sessione-sintetica';
    const { default: Page } = await import('../src/app/[[...percorso]]/page');
    await expect(Page(parametri(['anteprima', '..%2F..%2Fpublic']))).rejects.toEqual(NON_TROVATO);
    expect(api.getPreview).not.toHaveBeenCalled();
  });

  it('con il cookie chiede l’anteprima con la sola sessione e usa il percorso del contenuto', async () => {
    jar.values.amoris_sessione = 'sessione-sintetica';
    jar.values.altro_cookie = 'non-si-inoltra';
    api.getPreview.mockResolvedValue(contenuto('/chi-siamo/'));
    const { default: Page } = await import('../src/app/[[...percorso]]/page');
    const element = (await Page(parametri(['anteprima', ID]))) as {
      props: { currentPath: string; children: { props: { graph: unknown } }[] };
    };
    expect(api.getPreview).toHaveBeenCalledWith(ID, 'sessione-sintetica');
    expect(asked.names).toEqual(['amoris_sessione']);
    expect(element.props.currentPath).toBe('/chi-siamo/');
    const jsonLd = JSON.stringify(element.props.children[0]?.props.graph);
    expect(jsonLd).toContain('/chi-siamo/');
    expect(jsonLd).not.toContain('anteprima');
  });

  it('sulla pagina iniziale (API: percorso proprio e publicPath «/») il percorso corrente è «/»', async () => {
    jar.values.amoris_sessione = 'sessione-sintetica';
    api.getPreview.mockResolvedValue(contenuto('/casa-sintetica/', '/'));
    const { default: Page } = await import('../src/app/[[...percorso]]/page');
    const element = (await Page(parametri(['anteprima', ID]))) as {
      props: { currentPath: string; children: { props: { graph: unknown } }[] };
    };
    expect(element.props.currentPath).toBe('/');
    const jsonLd = JSON.stringify(element.props.children[0]?.props.graph);
    expect(jsonLd).not.toContain('casa-sintetica');
  });

  it('un UUID che l’API rifiuterebbe (variante non valida) è un 404 senza chiamarla', async () => {
    jar.values.amoris_sessione = 'sessione-sintetica';
    const { default: Page } = await import('../src/app/[[...percorso]]/page');
    await expect(
      Page(parametri(['anteprima', '12345678-1234-1234-1234-123456789012'])),
    ).rejects.toEqual(NON_TROVATO);
    expect(api.getPreview).not.toHaveBeenCalled();
  });

  // I `params` sono quelli che Next consegna davvero (verificati sotto con le sue funzioni).
  it.each([
    ['maiuscole', ['ANTEPRIMA', ID]],
    ['barra codificata', [`anteprima%2F${ID}`]],
  ])(
    'la variante «%s» non è un’anteprima: 404 e nessuna chiamata con la sessione',
    async (_n, segmenti) => {
      jar.values.amoris_sessione = 'sessione-sintetica';
      api.getContent.mockResolvedValue(null);
      const { default: Page } = await import('../src/app/[[...percorso]]/page');
      await expect(Page(parametri(segmenti))).rejects.toEqual(NON_TROVATO);
      expect(api.getPreview).not.toHaveBeenCalled();
    },
  );

  it('/%61nteprima/<id>/: Next consegna «anteprima», quindi è l’anteprima (e il proxy la tratta come tale)', async () => {
    jar.values.amoris_sessione = 'sessione-sintetica';
    api.getPreview.mockResolvedValue(contenuto('/chi-siamo/'));
    const { default: Page } = await import('../src/app/[[...percorso]]/page');
    await Page(parametri(['anteprima', ID]));
    expect(api.getPreview).toHaveBeenCalledWith(ID, 'sessione-sintetica');
  });

  it('i metadati sono quelli del contenuto: canonical sul suo percorso, robots del contenuto', async () => {
    jar.values.amoris_sessione = 'sessione-sintetica';
    api.getPreview.mockResolvedValue(contenuto('/chi-siamo/'));
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata(parametri(['anteprima', ID]));
    expect(meta.title).toBe('Pagina sintetica - Centro di prova');
    expect(meta.alternates?.canonical).toBe('/chi-siamo/');
    expect(meta.robots).toBe('index, follow');
  });

  it('un rifiuto dell’API (401, 403, 404) diventa un 404 come una pagina inesistente', async () => {
    jar.values.amoris_sessione = 'sessione-sintetica';
    api.getPreview.mockResolvedValue(null);
    const { default: Page } = await import('../src/app/[[...percorso]]/page');
    await expect(Page(parametri(['anteprima', ID]))).rejects.toEqual(NON_TROVATO);
  });
});

describe('lettura dell’anteprima dall’API (S15)', () => {
  it('inoltra solo il cookie di sessione e tratta 400, 401, 403, 404 e 422 come assenza', async () => {
    const reale = await vi.importActual<typeof ApiModule>('../src/lib/api');
    for (const status of [400, 401, 403, 404, 422]) {
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status }));
      vi.stubGlobal('fetch', fetchMock);
      expect(await reale.getPreview(ID, 'sessione-sintetica')).toBeNull();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(new RegExp(`/contents/${ID}/preview$`));
      expect(init.headers).toEqual({ cookie: 'amoris_sessione=sessione-sintetica' });
      expect(init.cache).toBe('no-store');
    }
  });

  it.each([429, 500, 503])('l’esito %i resta un errore del servizio', async (status) => {
    const reale = await vi.importActual<typeof ApiModule>('../src/lib/api');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    await expect(reale.getPreview(ID, 'sessione-sintetica')).rejects.toBeInstanceOf(
      reale.ApiUnavailable,
    );
  });

  it('il nome del cookie segue SESSION_COOKIE_NAME', async () => {
    vi.stubEnv('SESSION_COOKIE_NAME', 'sessione_collaudo');
    vi.resetModules();
    const reale = await vi.importActual<typeof ApiModule>('../src/lib/api');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    await reale.getPreview(ID, 'x');
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers).toEqual({
      cookie: 'sessione_collaudo=x',
    });
    expect(reale.SESSION_COOKIE_NAME).toBe('sessione_collaudo');
  });
});

describe('intestazioni dell’anteprima (S16)', () => {
  it('su /anteprima/ mette le tre intestazioni e non cerca redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { proxy } = await import('../src/proxy');
    const response = await proxy(new NextRequest(`http://localhost:3200/anteprima/${ID}/`));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it.each(['/ANTEPRIMA/' + ID + '/', '/anteprima%2F' + ID + '/', '/anteprima%E0%A4%A/' + ID + '/'])(
    'la variante %s non è l’anteprima: niente intestazioni, si cercano i redirect',
    async (percorso) => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
      vi.stubGlobal('fetch', fetchMock);
      const { proxy } = await import('../src/proxy');
      const response = await proxy(new NextRequest(`http://localhost:3200${percorso}`));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(response.headers.get('x-robots-tag')).toBeNull();
    },
  );

  it('/%61nteprima/<id>/ è l’anteprima, come la pagina: intestazioni e nessun redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { proxy } = await import('../src/proxy');
    const response = await proxy(new NextRequest(`http://localhost:3200/%61nteprima/${ID}/`));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('proxy e pagina concordano su ogni variante, con le funzioni di Next per i params', async () => {
    // Sensibile alla versione: usa gli interni di Next e va riverificato a ogni aggiornamento di `next`.
    const dist = 'next/dist/shared/lib/router/utils';
    const { getRouteRegex } = await import(`${dist}/route-regex.js`);
    const { getRouteMatcher } = await import(`${dist}/route-matcher.js`);
    const { getDynamicParam } = await import(`${dist}/get-dynamic-param.js`);
    const { asNextParams, isPreviewPath } = await import('../src/lib/previewPath');
    const match = getRouteMatcher(getRouteRegex('/[[...percorso]]'));
    for (const raw of [
      `/anteprima/${ID}/`,
      `/%61nteprima/${ID}/`,
      `/ANTEPRIMA/${ID}/`,
      `/anteprima%2F${ID}/`,
    ]) {
      const params = getDynamicParam(match(raw), 'percorso', 'oc', null, null).value as string[];
      const dellaPagina = `/${params.join('/')}/`;
      expect(isPreviewPath(asNextParams(raw)), raw).toBe(isPreviewPath(dellaPagina));
    }
  });

  it('fuori da /anteprima/ non aggiunge nulla e cerca i redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const { proxy } = await import('../src/proxy');
    const response = await proxy(new NextRequest('http://localhost:3200/chi-siamo/'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get('x-robots-tag')).toBeNull();
  });

  it('robots.txt non nomina /anteprima (un Disallow nasconderebbe l’intestazione)', async () => {
    const { default: robots } = await import('../src/app/robots');
    expect(JSON.stringify(robots())).not.toContain('anteprima');
  });
});
