import { describe, expect, it } from 'vitest';
import { deriveShowTitle } from '../../../src/stages/contents/meta.js';

/**
 * `show_title` come lo decide il tema (DR-119). Nel modello di pagina di Divi
 * (`page.php`) il titolo compare solo se la pagina **non** usa il Divi Builder;
 * nel modello di articolo (`single.php`) conta solo `_et_pb_show_title`.
 * Dati sintetici.
 */

const meta = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe('show_title (DR-119)', () => {
  it('una pagina costruita con il Divi Builder non mostra il titolo', () => {
    expect(deriveShowTitle(meta({ _et_pb_use_builder: 'on' }), 'page')).toBe(false);
  });

  it('un articolo costruito con il Divi Builder mostra il titolo, se non è spento', () => {
    expect(deriveShowTitle(meta({ _et_pb_use_builder: 'on' }), 'post')).toBe(true);
    expect(
      deriveShowTitle(meta({ _et_pb_use_builder: 'on', _et_pb_show_title: 'off' }), 'post'),
    ).toBe(false);
  });

  it('una pagina senza Builder mostra il titolo, salvo il plugin che lo nasconde', () => {
    expect(deriveShowTitle(meta({}), 'page')).toBe(true);
    expect(deriveShowTitle(meta({ _et_pb_use_builder: 'off' }), 'page')).toBe(true);
    expect(deriveShowTitle(meta({ st_hide_title_check_option: 'on' }), 'page')).toBe(false);
  });
});
