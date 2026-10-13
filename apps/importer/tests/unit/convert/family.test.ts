import { describe, expect, it } from 'vitest';
import { detectContentFamily } from '../../../src/convert/family.js';

describe('detectContentFamily — scelta per contenuto (ADR-005 §1 punto 1)', () => {
  it('un commento wp: è Gutenberg', () => {
    expect(detectContentFamily('<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->')).toBe(
      'gutenberg',
    );
  });

  it('uno shortcode et_pb_ senza commenti wp: è Divi', () => {
    expect(detectContentFamily('[et_pb_section][et_pb_row][/et_pb_row][/et_pb_section]')).toBe(
      'divi',
    );
  });

  it("né l'uno né l'altro è HTML nudo", () => {
    expect(detectContentFamily('<p>solo html</p>')).toBe('html');
  });

  it('vuoto è HTML nudo', () => {
    expect(detectContentFamily('')).toBe('html');
  });

  // ADR-005 §1 conta fra i Divi i contenuti racchiusi nel marcatore: caso reale
  // di 7 contenuti (es. ID 1138), con il marcatore aperto e mai chiuso.
  it('il marcatore wp:divi/placeholder con shortcode et_pb_ è Divi', () => {
    expect(
      detectContentFamily('<!-- wp:divi/placeholder -->\n[et_pb_section][/et_pb_section]'),
    ).toBe('divi');
    expect(
      detectContentFamily(
        '<!-- wp:divi/placeholder -->[et_pb_section][/et_pb_section]<!-- /wp:divi/placeholder -->',
      ),
    ).toBe('divi');
  });

  it('il marcatore vuoto resta Gutenberg (bozza 1781)', () => {
    expect(detectContentFamily('<!-- wp:divi/placeholder /-->')).toBe('gutenberg');
  });

  it('un blocco Gutenberg vero accanto al marcatore resta Gutenberg', () => {
    expect(
      detectContentFamily(
        '<!-- wp:divi/placeholder -->[et_pb_section][/et_pb_section]<!-- /wp:divi/placeholder --><!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->',
      ),
    ).toBe('gutenberg');
  });
});
