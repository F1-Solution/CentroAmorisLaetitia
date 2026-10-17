import { describe, expect, it } from 'vitest';
import { detectContentFamily } from '../../../src/convert/family.js';
import {
  applyMembersRestriction,
  deriveGutterWidth,
  derivePageLayout,
  deriveShowTitle,
  publicationDateSource,
} from '../../../src/stages/contents/meta.js';

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

describe('restrizione di Members (DR-131)', () => {
  it('un contenuto riservato a dei ruoli mostra il messaggio della sorgente al posto del contenuto', () => {
    const risultato = applyMembersRestriction(
      '[wpdm_user_dashboard]',
      meta({ _members_access_role: 'ruolo' }),
    );
    expect(risultato).toBe('<p>Sorry, but you do not have permission to view this content.</p>');
  });

  it('un contenuto senza restrizione resta invariato', () => {
    expect(applyMembersRestriction('<p>testo</p>', meta({}))).toBe('<p>testo</p>');
  });
});

describe('famiglia d’origine e restrizione di Members (DR-136)', () => {
  it('la famiglia si legge sul testo originale: dopo la restrizione il marcatore Gutenberg non c’è più', () => {
    const original = '<!-- wp:shortcode -->\n[wpdm_user_dashboard]\n<!-- /wp:shortcode -->';
    expect(detectContentFamily(original)).toBe('gutenberg');
    const restricted = applyMembersRestriction(original, meta({ _members_access_role: 'ruolo' }));
    expect(detectContentFamily(restricted)).toBe('html');
  });
});

describe('layout della pagina come lo rende Divi (DR-139)', () => {
  // Regole misurate sulle classi del body dei 106 contenuti pubblicati della sorgente.
  const layout = (entries: Record<string, string>, type: 'page' | 'post' = 'post') =>
    derivePageLayout(meta(entries), type);

  it('articolo: il valore registrato, con o senza Divi Builder', () => {
    expect(layout({ _et_pb_page_layout: 'et_right_sidebar' })).toBe('right_sidebar');
    expect(layout({ _et_pb_page_layout: 'et_full_width_page', _et_pb_use_builder: 'on' })).toBe(
      'full_width',
    );
    expect(layout({ _et_pb_page_layout: 'et_no_sidebar', _et_pb_use_builder: 'on' })).toBe(
      'no_sidebar',
    );
    expect(layout({ _et_pb_page_layout: 'et_right_sidebar', _et_pb_use_builder: 'on' })).toBe(
      'right_sidebar',
    );
  });

  it('«senza barra» senza Divi Builder si rende a tutta larghezza', () => {
    expect(layout({ _et_pb_page_layout: 'et_no_sidebar', _et_pb_use_builder: 'off' })).toBe(
      'full_width',
    );
    expect(layout({ _et_pb_page_layout: 'et_no_sidebar' }, 'page')).toBe('full_width');
  });

  it('pagina con Divi Builder: sempre senza barra', () => {
    expect(
      layout({ _et_pb_page_layout: 'et_right_sidebar', _et_pb_use_builder: 'on' }, 'page'),
    ).toBe('no_sidebar');
    expect(
      layout({ _et_pb_page_layout: 'et_full_width_page', _et_pb_use_builder: 'on' }, 'page'),
    ).toBe('no_sidebar');
  });

  it('assente o sconosciuto: il predefinito del tema, barra a destra', () => {
    expect(layout({}, 'page')).toBe('right_sidebar');
    expect(layout({ _et_pb_page_layout: 'et_left_sidebar' })).toBe('right_sidebar');
  });
});

describe('data di pubblicazione (1E-W6)', () => {
  it('usa post_date_gmt, che è già UTC: un articolo pubblicato alle 23 non scivola al giorno dopo', () => {
    expect(publicationDateSource('2026-05-05 21:30:00', '2026-05-05 23:30:00')).toBe(
      '2026-05-05 21:30:00',
    );
  });

  it('senza post_date_gmt valido ripiega sull’ora locale', () => {
    expect(publicationDateSource('0000-00-00 00:00:00', '2026-05-05 23:30:00')).toBe(
      '2026-05-05 23:30:00',
    );
    expect(publicationDateSource('', '2026-05-05 23:30:00')).toBe('2026-05-05 23:30:00');
  });
});

describe('spaziatura della pagina, `_et_pb_gutter_width` (DR-149)', () => {
  const gutter = (entries: Record<string, string>) => deriveGutterWidth(meta(entries));

  it('il valore registrato, da 1 a 4', () => {
    expect(gutter({ _et_pb_gutter_width: '3' })).toBe(3);
    expect(gutter({ _et_pb_gutter_width: '2' })).toBe(2);
    expect(gutter({ _et_pb_gutter_width: '1' })).toBe(1);
    expect(gutter({ _et_pb_gutter_width: '4' })).toBe(4);
  });

  it('assente o fuori scala: vuoto, cioè il valore del tema', () => {
    expect(gutter({})).toBeNull();
    expect(gutter({ _et_pb_gutter_width: '' })).toBeNull();
    expect(gutter({ _et_pb_gutter_width: '5' })).toBeNull();
    expect(gutter({ _et_pb_gutter_width: '2.5' })).toBeNull();
    expect(gutter({ _et_pb_gutter_width: 'on' })).toBeNull();
  });
});
