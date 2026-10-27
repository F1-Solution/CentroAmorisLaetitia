import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as NextServer from 'next/server';

/*
 * DR-280 (T2g): archivi delle categorie complete.
 *
 * - Una categoria figlia ha l'archivio sotto la genitrice, `/category/genitrice/figlia/`,
 *   come in WordPress; la paginazione `page/N/` resta in fondo, e anche il feed.
 * - La meta description dell'archivio è quella che l'API dà (SEO propria o
 *   `#taxonomy_description` di All in One SEO); senza, i metadati restano quelli di prima.
 *
 * Nomi e percorsi inventati.
 */

const api = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getTerm: vi.fn(),
  getPosts: vi.fn(),
}));

vi.mock('../src/lib/api', async (importOriginal) => {
  const reale = await importOriginal<typeof ApiModule>();
  return { ...reale, ...api };
});

vi.mock('next/server', async (importOriginal) => {
  const reale = await importOriginal<typeof NextServer>();
  return { ...reale, connection: vi.fn(async () => undefined) };
});

const parametri = (percorso: string[]) => ({
  params: Promise.resolve({ percorso }),
  searchParams: Promise.resolve({}),
});

const termine = (path: string) => ({
  id: 't-1',
  taxonomy: 'category',
  slug: 'figlia',
  name: 'Figlia sintetica',
  path,
  description: null,
});

const vuota = { items: [], media: {}, meta: { total: 0, page: 1, perPage: 6 } };

beforeEach(() => {
  vi.resetAllMocks();
  api.getSettings.mockResolvedValue({ 'site.title': 'Sito' });
  api.getPosts.mockResolvedValue(vuota);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('archivio di una categoria figlia', () => {
  it('/category/genitrice/figlia/ si risolve con il percorso intero', async () => {
    api.getTerm.mockResolvedValue({
      term: termine('/category/genitrice/figlia/'),
      seo: {
        title: 'Figlia sintetica - Sito',
        description: null,
        robots: 'max-image-preview:large',
      },
    });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata(parametri(['category', 'genitrice', 'figlia']));
    expect(api.getTerm).toHaveBeenCalledWith('/category/genitrice/figlia/');
    expect(api.getPosts).toHaveBeenCalledWith(['t-1'], 1, 6);
    expect(meta.title).toBe('Figlia sintetica - Sito');
  });

  it('la pagina 2 di una figlia separa la paginazione dal percorso', async () => {
    api.getTerm.mockResolvedValue({
      term: termine('/category/genitrice/figlia/'),
      seo: { title: 'Figlia sintetica - Sito', description: null, robots: '' },
    });
    api.getPosts.mockResolvedValue({
      ...vuota,
      items: [{ id: 'p', path: '/p/', title: 'P', publishedAt: null }],
    });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata(
      parametri(['category', 'genitrice', 'figlia', 'page', '2']),
    );
    expect(api.getTerm).toHaveBeenCalledWith('/category/genitrice/figlia/');
    expect(api.getPosts).toHaveBeenCalledWith(['t-1'], 2, 6);
    expect(meta.title).toBe('Figlia sintetica - Sito - Pagina 2');
  });
});

describe('metadati dell’archivio', () => {
  it('con la descrizione dell’API compare la meta description', async () => {
    api.getTerm.mockResolvedValue({
      term: termine('/category/news/'),
      seo: { title: 'News - Sito', description: 'Descrizione sintetica.', robots: 'noindex' },
    });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata(parametri(['category', 'news']));
    expect(meta).toEqual({
      title: 'News - Sito',
      description: 'Descrizione sintetica.',
      robots: 'noindex',
      alternates: { canonical: '/category/news/' },
    });
  });

  it('senza descrizione i metadati sono quelli di prima: nessuna chiave description', async () => {
    api.getTerm.mockResolvedValue({
      term: termine('/category/news/'),
      seo: { title: 'News - Sito', description: null, robots: 'max-image-preview:large' },
    });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata(parametri(['category', 'news']));
    expect(meta).toEqual({
      title: 'News - Sito',
      robots: 'max-image-preview:large',
      alternates: { canonical: '/category/news/' },
    });
  });
});

describe('feed di una categoria figlia', () => {
  it('/category/genitrice/figlia/feed/ chiede il termine con il percorso intero', async () => {
    const chiamate: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        chiamate.push(url);
        if (url.includes('/public/terms')) {
          return new Response(JSON.stringify({ term: { id: 't-1', name: 'Figlia' } }));
        }
        if (url.includes('/public/posts')) return new Response(JSON.stringify({ items: [] }));
        return new Response('{}');
      }),
    );
    const { proxy } = await import('../src/proxy');
    const risposta = await proxy(
      new NextRequest('http://localhost:3200/category/genitrice/figlia/feed/'),
    );
    expect(
      chiamate.some((u) => u.endsWith(`path=${encodeURIComponent('/category/genitrice/figlia/')}`)),
    ).toBe(true);
    expect(risposta.headers.get('content-type')).toContain('application/rss+xml');
  });
});
