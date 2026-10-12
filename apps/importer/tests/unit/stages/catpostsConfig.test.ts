import { describe, expect, it } from 'vitest';
import { expandCatposts } from '../../../src/stages/contents/catposts.js';

/**
 * `[catposts name="X"]` nomina una configurazione salvata dal plugin Category Posts
 * nei metadati della pagina (`categoryPosts-shorcode`), non una categoria (DR-116).
 * La fase `contents` riporta nello shortcode i parametri di quella configurazione,
 * così che il convertitore li veda. Dati sintetici, serializzati come li salva PHP.
 */

const config =
  'a:1:{s:7:"Notizie";a:6:{s:3:"cat";s:1:"0";s:3:"num";s:2:"10";s:5:"thumb";s:1:"1";s:4:"date";s:1:"1";s:7:"excerpt";s:1:"1";s:5:"title";s:11:"Ultime news";}}';

describe('configurazione salvata di [catposts] (DR-116)', () => {
  it('riporta nello shortcode numero, categoria e opzioni della configurazione', () => {
    const out = expandCatposts(
      '<p>[catposts name="Notizie" thumb="true"]</p>',
      new Map([['categoryPosts-shorcode', config]]),
    );
    expect(out).toBe(
      '<p>[catposts name="Notizie" thumb="true" cat="0" number="10" date="1" excerpt="1"]</p>',
    );
  });

  it('senza configurazione, o con un nome sconosciuto, lascia lo shortcode com’è', () => {
    const text = '<p>[catposts name="Altro"]</p>';
    expect(expandCatposts(text, new Map())).toBe(text);
    expect(expandCatposts(text, new Map([['categoryPosts-shorcode', config]]))).toBe(text);
  });
});
