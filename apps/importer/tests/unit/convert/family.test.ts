import { describe, expect, it } from 'vitest';
import { detectContentFamily } from '../../../src/convert/family.js';

describe('detectContentFamily — scelta per contenuto (ADR-005 §1 punto 1)', () => {
  it('un commento wp: è Gutenberg', () => {
    expect(detectContentFamily('<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->')).toBe('gutenberg');
  });

  it('uno shortcode et_pb_ senza commenti wp: è Divi', () => {
    expect(detectContentFamily('[et_pb_section][et_pb_row][/et_pb_row][/et_pb_section]')).toBe('divi');
  });

  it('né l\'uno né l\'altro è HTML nudo', () => {
    expect(detectContentFamily('<p>solo html</p>')).toBe('html');
  });

  it('vuoto è HTML nudo', () => {
    expect(detectContentFamily('')).toBe('html');
  });
});
