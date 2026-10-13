import { describe, expect, it } from 'vitest';
import {
  normalizeSameSiteUrls,
  normalizeSameSiteUrlValue,
} from '../../../src/convert/shared/url-normalize.js';

/**
 * Famiglia J della `1E-W6`: la sequenza `//host` va normalizzata solo quando
 * l'URL è relativo allo schema. Dentro un URL assoluto (`https://host/…`) la
 * stessa sequenza c'è, ma toccarla produceva `https:/x/` nell'`href` e nel
 * testo visibile (97 occorrenze in 47 contenuti).
 */

describe('normalizeSameSiteUrls', () => {
  it('relativo allo schema del sito → percorso relativo', () => {
    const out = normalizeSameSiteUrls('<a href="//www.centroamorislaetitia.it/chi-siamo/">x</a>');
    expect(out.html).toBe('<a href="/chi-siamo/">x</a>');
    expect(out.count).toBe(1);
  });

  it('host senza www e senza percorso', () => {
    const out = normalizeSameSiteUrls("<img src='//centroamorislaetitia.it'>");
    expect(out.html).toBe("<img src='/'>");
    expect(out.count).toBe(1);
  });

  it('assoluto https invariato, nell’href e nel testo visibile', () => {
    const html =
      '<a href="https://www.centroamorislaetitia.it/circolo-della-sicurezza/">https://www.centroamorislaetitia.it/circolo-della-sicurezza/</a>';
    const out = normalizeSameSiteUrls(html);
    expect(out.html).toBe(html);
    expect(out.count).toBe(0);
  });

  it('assoluto http invariato', () => {
    const html = '<a href="http://centroamorislaetitia.it/x/">x</a>';
    expect(normalizeSameSiteUrls(html).html).toBe(html);
  });

  it('nello stesso frammento: assoluto invariato, relativo normalizzato', () => {
    const out = normalizeSameSiteUrls(
      '<a href="https://www.centroamorislaetitia.it/a/">a</a> <a href="//www.centroamorislaetitia.it/b/">b</a>',
    );
    expect(out.html).toBe(
      '<a href="https://www.centroamorislaetitia.it/a/">a</a> <a href="/b/">b</a>',
    );
    expect(out.count).toBe(1);
  });

  it('un host esterno relativo allo schema resta intatto', () => {
    const html = '<script src="//cdn.example.org/x.js"></script>';
    expect(normalizeSameSiteUrls(html).html).toBe(html);
  });
});

describe('normalizeSameSiteUrlValue', () => {
  it('normalizza un valore relativo allo schema', () => {
    expect(normalizeSameSiteUrlValue('//www.centroamorislaetitia.it/media/a.jpg')).toEqual({
      value: '/media/a.jpg',
      normalized: true,
    });
  });

  it('lascia un valore assoluto com’è', () => {
    expect(normalizeSameSiteUrlValue('https://www.centroamorislaetitia.it/media/a.jpg')).toEqual({
      value: 'https://www.centroamorislaetitia.it/media/a.jpg',
      normalized: false,
    });
  });
});
