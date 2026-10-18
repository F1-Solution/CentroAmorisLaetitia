import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';

/*
 * M8 (DR-181): `/download-category/<slug>/` risolve il termine di Download Manager
 * e ne elenca i documenti; DR-188: metadataBase da SITE_URL. L'API è sostituita da
 * un doppio con dati sintetici, sul contratto concordato con il servizio.
 */

const api = vi.hoisted(() => ({
  getTerm: vi.fn(),
  getDocuments: vi.fn(),
  getDocument: vi.fn(),
  getContent: vi.fn(),
  getPosts: vi.fn(),
  searchContents: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock('../src/lib/api', async (importOriginal) => {
  const reale = await importOriginal<typeof ApiModule>();
  return { ...reale, ...api };
});

const termine = {
  id: '11111111-1111-4111-8111-111111111111',
  taxonomy: 'wpdmcategory',
  slug: 'moduli-sintetici',
  name: 'Moduli sintetici',
  path: '/download-category/moduli-sintetici/',
  description: null,
};

const parametri = (percorso: string[]) => ({
  params: Promise.resolve({ percorso }),
  searchParams: Promise.resolve({}),
});

beforeEach(() => {
  vi.resetAllMocks();
  api.getSettings.mockResolvedValue({ 'site.title': 'Centro di prova' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('categoria dei download (DR-181)', () => {
  it('title come la sorgente, robots e canonical autoreferenziale', async () => {
    api.getTerm.mockResolvedValue({
      term: termine,
      seo: { title: 'Moduli sintetici - Centro di prova', robots: 'max-image-preview:large' },
    });
    api.getDocuments.mockResolvedValue({ items: [], media: {} });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata(parametri(['download-category', 'moduli-sintetici']));
    expect(meta.title).toBe('Moduli sintetici - Centro di prova');
    expect(meta.robots).toBe('max-image-preview:large');
    expect(meta.alternates?.canonical).toBe('/download-category/moduli-sintetici/');
    expect(api.getTerm).toHaveBeenCalledWith('/download-category/moduli-sintetici/');
    expect(api.getDocuments).toHaveBeenCalledWith(termine.id);
  });

  it('risolve anche una categoria annidata, come i percorsi che l’importer costruisce', async () => {
    api.getTerm.mockResolvedValue({
      term: { ...termine, path: '/download-category/genitori/figli/' },
      seo: { title: 'Figli - Centro di prova', robots: 'max-image-preview:large' },
    });
    api.getDocuments.mockResolvedValue({ items: [], media: {} });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata(parametri(['download-category', 'genitori', 'figli']));
    expect(meta.title).toBe('Figli - Centro di prova');
    expect(api.getTerm).toHaveBeenCalledWith('/download-category/genitori/figli/');
  });

  it('senza SEO del termine: nome e sito, max-image-preview:large', async () => {
    api.getTerm.mockResolvedValue({ term: termine, seo: { title: '', robots: '' } });
    api.getDocuments.mockResolvedValue({ items: [], media: {} });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata(parametri(['download-category', 'altra']));
    expect(meta.title).toBe('Moduli sintetici - Centro di prova');
    expect(meta.robots).toBe('max-image-preview:large');
  });

  it('prova negativa: un termine di un’altra tassonomia è un 404', async () => {
    api.getTerm.mockResolvedValue({
      term: { ...termine, taxonomy: 'category' },
      seo: { title: 'X', robots: '' },
    });
    const { generateMetadata } = await import('../src/app/[[...percorso]]/page');
    const meta = await generateMetadata(parametri(['download-category', 'finta']));
    expect(meta.title).toBe('404 Non trovato | Centro di prova');
    expect(api.getDocuments).not.toHaveBeenCalled();
  });
});

describe('metadataBase (DR-188, DR-196)', () => {
  it('assoluto da SITE_URL, letto alla richiesta', async () => {
    vi.stubEnv('SITE_URL', 'https://sito.example.invalid/');
    const { generateMetadata } = await import('../src/app/layout');
    expect(generateMetadata().metadataBase?.toString()).toBe('https://sito.example.invalid/');
  });
});
