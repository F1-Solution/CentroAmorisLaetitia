import { afterEach, describe, expect, it, vi } from 'vitest';

// M7 (1E-W7, DR-176): `robots.txt` esclude l'area amministrativa e dichiara la
// sitemap con l'indirizzo assoluto del sito; nessuna regola sui percorsi WordPress.
describe('robots.txt (DR-176)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function robotsCon(siteUrl: string) {
    vi.stubEnv('SITE_URL', siteUrl);
    vi.resetModules();
    const { default: robots } = await import('../src/app/robots');
    return robots();
  }

  it('esclude /admin e dichiara la sitemap assoluta', async () => {
    const r = await robotsCon('https://sito.example.invalid');
    expect(r.rules).toEqual([{ userAgent: '*', disallow: '/admin' }]);
    expect(r.sitemap).toBe('https://sito.example.invalid/sitemap.xml');
  });

  it('toglie la barra finale dall’indirizzo del sito', async () => {
    const r = await robotsCon('https://sito.example.invalid/');
    expect(r.sitemap).toBe('https://sito.example.invalid/sitemap.xml');
  });

  it('non contiene regole sui percorsi di WordPress', async () => {
    const r = await robotsCon('https://sito.example.invalid');
    expect(JSON.stringify(r)).not.toMatch(/wp-/);
  });
});
