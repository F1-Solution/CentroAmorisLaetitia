import { describe, expect, it } from 'vitest';
import { convertContent } from '../../../src/convert/index.js';

/**
 * WordPress toglie `wpautop()` dalla resa dei contenuti con blocchi (`has_blocks`):
 * gli «a capo» dentro un blocco Gutenberg non diventano `<br>`. Dati sintetici.
 */

describe('Gutenberg senza wpautop', () => {
  it('gli a capo dentro un paragrafo non diventano br', () => {
    const result = convertContent({
      legacyContentId: 950,
      postContent:
        '<!-- wp:paragraph -->\n<p>Riga sintetica\nseconda riga</p>\n<!-- /wp:paragraph -->',
    });
    const html = JSON.stringify(result.document.blocks);
    expect(html).not.toContain('<br');
  });

  it('i contenuti senza blocchi li ricevono, come nella sorgente', () => {
    const result = convertContent({
      legacyContentId: 951,
      postContent: 'Riga sintetica\nseconda riga',
    });
    expect(JSON.stringify(result.document.blocks)).toContain('<br');
  });
});
