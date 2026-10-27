import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiUnavailable } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import config from '../next.config';

/*
 * DR-273 con DR-284: il titolo di riserva del layout e quello della 404 leggono
 * «Titolo del sito»; `htmlLimitedBots` tiene il `<title>` nell'`<head>` anche quando
 * i metadati sono asincroni. Dati sintetici.
 */

const api = vi.hoisted(() => ({ getSettings: vi.fn() }));

vi.mock('../src/lib/api', async (importOriginal) => {
  const reale = await importOriginal<typeof ApiModule>();
  return { ...reale, ...api };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('«Titolo del sito» nel layout e nella 404 (DR-273)', () => {
  it('il titolo di riserva del layout è il titolo del sito', async () => {
    const { generateMetadata } = await import('../src/app/layout');
    api.getSettings.mockResolvedValue({ 'site.title': 'Centro Amoris Laetitia' });
    expect((await generateMetadata()).title).toBe('Centro Amoris Laetitia');
    api.getSettings.mockResolvedValue({ 'site.title': 'Sito di prova' });
    expect((await generateMetadata()).title).toBe('Sito di prova');
  });

  it('la 404 scrive «404 Non trovato | <titolo del sito>»', async () => {
    api.getSettings.mockResolvedValue({ 'site.title': 'Sito di prova' });
    const { generateMetadata } = await import('../src/app/not-found');
    expect((await generateMetadata()).title).toBe('404 Non trovato | Sito di prova');
  });

  it('senza impostazione tornano i valori di oggi', async () => {
    api.getSettings.mockResolvedValue({});
    const layout = await import('../src/app/layout');
    expect((await layout.generateMetadata()).title).toBe('Centro Amoris Laetitia');
    const notFound = await import('../src/app/not-found');
    expect((await notFound.generateMetadata()).title).toBe(
      '404 Non trovato | Centro Amoris Laetitia',
    );
  });

  it('se l’API non risponde tornano i valori di oggi', async () => {
    api.getSettings.mockRejectedValue(new ApiUnavailable('servizio non raggiungibile'));
    const layout = await import('../src/app/layout');
    expect((await layout.generateMetadata()).title).toBe('Centro Amoris Laetitia');
    const notFound = await import('../src/app/not-found');
    expect((await notFound.generateMetadata()).title).toBe(
      '404 Non trovato | Centro Amoris Laetitia',
    );
  });

  it('un errore diverso dall’API non raggiungibile passa', async () => {
    api.getSettings.mockRejectedValue(new Error('interno'));
    const { generateMetadata } = await import('../src/app/layout');
    await expect(generateMetadata()).rejects.toThrow('interno');
  });

  it('il layout mantiene metadataBase da SITE_URL', async () => {
    vi.stubEnv('SITE_URL', 'https://sito.example.invalid/');
    api.getSettings.mockResolvedValue({ 'site.title': 'Sito di prova' });
    const { generateMetadata } = await import('../src/app/layout');
    expect((await generateMetadata()).metadataBase?.toString()).toBe(
      'https://sito.example.invalid/',
    );
    vi.unstubAllEnvs();
  });
});

describe('metadati nell’head (DR-284)', () => {
  it('htmlLimitedBots riconosce ogni user agent', () => {
    const bots = (config as { htmlLimitedBots?: RegExp }).htmlLimitedBots;
    expect(bots).toBeInstanceOf(RegExp);
    expect(bots?.test('Mozilla/5.0 (Windows NT 10.0) Chrome/130')).toBe(true);
  });
});
