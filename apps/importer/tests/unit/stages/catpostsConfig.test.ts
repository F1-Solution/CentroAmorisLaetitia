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

// Come la misura reale sull'istanza di riferimento: `offset` intero, non stringa.
const configWithOffset =
  'a:1:{s:4:"News";a:7:{s:3:"cat";s:1:"0";s:3:"num";s:2:"10";s:6:"offset";i:1;s:5:"thumb";s:1:"1";s:4:"date";s:1:"1";s:7:"excerpt";s:1:"1";s:5:"title";s:11:"Ultime news";}}';

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

  it('riporta anche «offset», come lo salva la configurazione «News» della home', () => {
    const out = expandCatposts(
      '<p>[catposts name="News"]</p>',
      new Map([['categoryPosts-shorcode', configWithOffset]]),
    );
    expect(out).toBe(
      '<p>[catposts name="News" cat="0" number="10" thumb="1" date="1" excerpt="1" offset="1"]</p>',
    );
  });

  // Forma reale della configurazione «News» (1E-W6): booleani `b:`, misure e testo del link.
  it('riporta booleani, misure della miniatura, estratto e miniatura di riserva', () => {
    const real =
      'a:1:{s:4:"News";a:9:{s:5:"thumb";b:1;s:8:"thumbTop";b:1;s:4:"date";b:1;s:7:"excerpt";b:0;s:7:"thumb_w";s:3:"100";s:7:"thumb_h";s:3:"100";s:14:"excerpt_length";s:3:"100";s:17:"excerpt_more_text";s:11:"leggi tutto";s:18:"default_thunmbnail";s:2:"58";}}';
    const out = expandCatposts(
      '[catposts name="News"]',
      new Map([['categoryPosts-shorcode', real]]),
      (id) => (id === '58' ? '/wp-content/uploads/2017/09/sintetica.jpg' : null),
    );
    expect(out).toBe(
      '[catposts name="News" thumb="1" date="1" excerpt="0" thumb_top="1" thumb_w="100" thumb_h="100" excerpt_length="100" excerpt_more_text="leggi tutto" default_thumbnail="/wp-content/uploads/2017/09/sintetica.jpg"]',
    );
  });

  it('senza configurazione, o con un nome sconosciuto, lascia lo shortcode com’è', () => {
    const text = '<p>[catposts name="Altro"]</p>';
    expect(expandCatposts(text, new Map())).toBe(text);
    expect(expandCatposts(text, new Map([['categoryPosts-shorcode', config]]))).toBe(text);
  });
});
