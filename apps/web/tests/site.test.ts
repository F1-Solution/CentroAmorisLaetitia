import { describe, expect, it } from 'vitest';
import { siteUrl } from '../src/lib/site';

// DR-196: in produzione `SITE_URL` è obbligatoria e la sua assenza si scopre alla
// prima richiesta, non alla compilazione (`next build` gira con NODE_ENV=production
// e deve riuscire comunque); in sviluppo e nelle prove vale il predefinito.
describe('siteUrl (DR-196)', () => {
  it('usa SITE_URL senza la barra finale', () => {
    expect(siteUrl({ SITE_URL: 'https://sito.example.invalid/', NODE_ENV: 'production' })).toBe(
      'https://sito.example.invalid',
    );
  });

  it('in sviluppo e nelle prove, senza SITE_URL, vale il predefinito locale', () => {
    expect(siteUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(siteUrl({ NODE_ENV: 'test' })).toBe('http://localhost:3000');
    expect(siteUrl({})).toBe('http://localhost:3000');
  });

  it('in produzione, senza SITE_URL, ferma la richiesta con un errore chiaro in italiano', () => {
    expect(() => siteUrl({ NODE_ENV: 'production' })).toThrow(/SITE_URL.*obbligatoria/);
    expect(() => siteUrl({ NODE_ENV: 'production', SITE_URL: '   ' })).toThrow(/SITE_URL/);
  });

  it('durante la compilazione di produzione non ferma `next build`', () => {
    expect(siteUrl({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })).toBe(
      'http://localhost:3000',
    );
  });

  it('rifiuta un valore che non è un indirizzo http o https assoluto', () => {
    expect(() => siteUrl({ SITE_URL: 'sito.example.invalid', NODE_ENV: 'test' })).toThrow(
      /SITE_URL/,
    );
    expect(() => siteUrl({ SITE_URL: 'ftp://sito.example.invalid', NODE_ENV: 'test' })).toThrow(
      /SITE_URL/,
    );
  });

  it('legge l’ambiente del processo quando non gliene si passa uno', () => {
    const prima = process.env.SITE_URL;
    process.env.SITE_URL = 'https://processo.example.invalid';
    try {
      expect(siteUrl()).toBe('https://processo.example.invalid');
    } finally {
      if (prima === undefined) delete process.env.SITE_URL;
      else process.env.SITE_URL = prima;
    }
  });
});
