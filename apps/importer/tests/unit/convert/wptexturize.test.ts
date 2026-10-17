import { describe, expect, it } from 'vitest';
import { texturizePlain, wptexturize } from '../../../src/convert/shared/wptexturize.js';

/**
 * Porto di `wptexturize()` della sorgente con la traduzione `it_IT` (DR-151).
 * Casi ricavati dalle regole di `wp-includes/formatting.php`; testi sintetici.
 */

describe('wptexturize — virgolette e apostrofi', () => {
  it('virgolette doppie aperte e chiuse', () => {
    expect(wptexturize('Il corso "Riparare le relazioni" riparte.')).toBe(
      'Il corso “Riparare le relazioni” riparte.',
    );
  });

  it('virgolette singole e apostrofo in parola', () => {
    expect(wptexturize("Io e l'altro: 'imparare' insieme")).toBe(
      'Io e l’altro: ‘imparare’ insieme',
    );
  });

  it("elisioni italiane della traduzione: po', be', da'", () => {
    expect(wptexturize("Un po' di tempo, be' sì, da' retta")).toBe(
      'Un po’ di tempo, be’ sì, da’ retta',
    );
  });

  it('virgolette in apertura di testo e dopo una parentesi', () => {
    expect(wptexturize('"Ciao" (e "arrivederci")')).toBe('“Ciao” (e “arrivederci”)');
  });

  it('numeri fra virgolette e primi', () => {
    expect(wptexturize('Misura 9\' e 9" circa')).toBe('Misura 9′ e 9″ circa');
    expect(wptexturize('Il valore "42" esatto')).toBe('Il valore “42” esatto');
  });

  it('anno abbreviato', () => {
    expect(wptexturize("Le edizioni del '99 e del '02.")).toBe('Le edizioni del ’99 e del ’02.');
  });
});

describe('wptexturize — trattini, puntini, simboli', () => {
  it('trattino fra spazi diventa lineetta breve, tre trattini lineetta lunga', () => {
    expect(wptexturize('Terni - Umbria')).toBe('Terni – Umbria');
    expect(wptexturize('a --- b')).toBe('a — b');
    expect(wptexturize('a -- b')).toBe('a — b');
    expect(wptexturize('a--b')).toBe('a–b');
  });

  it('il trattino dentro una parola resta', () => {
    expect(wptexturize('Relazion-arti 2024-25')).toBe('Relazion-arti 2024-25');
  });

  it('puntini, marchio e moltiplicazione', () => {
    expect(wptexturize('E poi... fine (tm) 3x4')).toBe('E poi… fine ™ 3×4');
  });
});

describe('wptexturize — HTML', () => {
  it('non tocca tag, attributi e commenti', () => {
    const html =
      '<p class="a\'b"><a href="/l\'altro/" title="x - y">L\'altro</a><!-- "commento" --></p>';
    expect(wptexturize(html)).toBe(
      '<p class="a\'b"><a href="/l\'altro/" title="x - y">L’altro</a><!-- "commento" --></p>',
    );
  });

  it('non tocca pre, code, kbd, style, script, tt', () => {
    const html = '<p>"sì"</p><pre>"no"</pre><code>\'no\'</code><p>"sì"</p>';
    expect(wptexturize(html)).toBe('<p>“sì”</p><pre>"no"</pre><code>\'no\'</code><p>“sì”</p>');
  });

  it('virgolette che attraversano un tag in linea', () => {
    expect(wptexturize('<p>Il corso "<strong>Noi uomini</strong>" parte</p>')).toBe(
      '<p>Il corso “<strong>Noi uomini</strong>” parte</p>',
    );
  });

  it('una e commerciale nuda resta valida', () => {
    expect(wptexturize('<p>Tom & Jerry &amp; co</p>')).toBe('<p>Tom &amp; Jerry &amp; co</p>');
  });

  it('spazio unificatore come spazio', () => {
    expect(wptexturize('a&nbsp;-&nbsp;b')).toBe('a&nbsp;–&nbsp;b');
  });
});

describe('texturizePlain — titoli ed etichette in testo semplice', () => {
  it('trasforma e restituisce caratteri, non entità', () => {
    expect(texturizePlain('Riparte il corso "Relazion-arti"')).toBe(
      'Riparte il corso “Relazion-arti”',
    );
    expect(texturizePlain("Io e l'altro")).toBe('Io e l’altro');
    expect(texturizePlain('Tom & Jerry')).toBe('Tom & Jerry');
  });

  it('decodifica le entità già scritte nella sorgente', () => {
    expect(texturizePlain('Registrazione laboratorio &#8220;Litighiamo oggi?&#8221;')).toBe(
      'Registrazione laboratorio “Litighiamo oggi?”',
    );
  });

  it('vuoto resta vuoto', () => {
    expect(texturizePlain('')).toBe('');
  });
});
