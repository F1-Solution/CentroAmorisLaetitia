import { describe, expect, it } from 'vitest';
import {
  sanitizeSlideTitle,
  slideTitleAlignment,
  slideTitleEditText,
  slideTitleFromText,
  slideTitleHasMarkup,
  slideTitleIcons,
  slideTitleText,
} from '../src/sanitize/slide-title';

const IMPORTED = '<div align="center">Famiglia <br>in cammino <i class="fa-heart"></i></div>';

describe('titolo di una slide: sottoinsieme ammesso di HTML (W8-26, DR-307)', () => {
  it('tiene br e l’allineamento di div e p, senza stile in linea', () => {
    const html = sanitizeSlideTitle(IMPORTED);
    expect(html).toContain('<br>');
    expect(html).toContain('blk-slide-align-center');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('align=');
    expect(html).toContain('Famiglia');
    expect(html).toContain('in cammino');
  });

  it('accetta text-align solo con left, center, right', () => {
    expect(sanitizeSlideTitle('<p style="text-align: right">A</p>')).toContain(
      'blk-slide-align-right',
    );
    expect(sanitizeSlideTitle('<p style="text-align: justify">A</p>')).not.toContain(
      'blk-slide-align',
    );
    expect(sanitizeSlideTitle('<div align="evil">A</div>')).not.toContain('blk-slide-align');
  });

  // T2b (DR-311): il sito carica un sottoinsieme di Font Awesome con il solo cuore.
  it('tiene il cuore come icona del sito, nascosta ai lettori di schermo', () => {
    const icon = '<i class="blk-slide-icon-heart" aria-hidden="true"></i>';
    expect(sanitizeSlideTitle('<i class="fa-heart"></i>Ciao')).toBe(`${icon}Ciao`);
    expect(sanitizeSlideTitle('Ciao <i class="fa fa-heart"></i>')).toBe(`Ciao ${icon}`);
    expect(sanitizeSlideTitle(icon)).toBe(icon);
    const once = sanitizeSlideTitle(IMPORTED);
    expect(once).toContain(`in cammino ${icon}</span>`);
    expect(sanitizeSlideTitle(once)).toBe(once);
  });

  // T2b: solo il cuore, solo con la classe e senza contenuto; tutto il resto si toglie come prima.
  it('toglie ogni altra icona, attributo, contenuto o forma dell’elemento i', () => {
    const removed = [
      '<i class="fa-star"></i>',
      '<i class="fa-heart fa-star"></i>',
      '<i class="fa-heart fa-2x"></i>',
      '<i class="FA-HEART"></i>',
      '<i class="fa"></i>',
      '<i></i>',
      '<i class="fa-heart" onclick="alert(1)"></i>',
      '<i class="fa-heart" style="color:red"></i>',
      '<i class="fa-heart" id="x"></i>',
      '<i class="fa-heart" aria-hidden="true"></i>',
      '<i class="blk-slide-icon-heart"></i>',
      '<i class="blk-slide-icon-heart" aria-hidden="false"></i>',
      '<i class="blk-slide-icon-heart" aria-hidden="true" onclick="x()"></i>',
      '<i class="blk-slide-icon-heart fa-heart" aria-hidden="true"></i>',
      '<span class="fa-heart"></span>',
      '<b class="fa-heart"></b>',
    ];
    for (const input of removed) expect(sanitizeSlideTitle(`A${input}B`)).toBe('AB');
    // Un `i` con contenuto si toglie e ne resta il testo.
    expect(sanitizeSlideTitle('<i class="fa-heart">testo</i>')).toBe('testo');
    expect(sanitizeSlideTitle('<i class="fa-heart"> </i>')).toBe(' ');
    expect(sanitizeSlideTitle('<i class="fa-heart"><script>x</script></i>')).toBe('');
    // Annidamenti: resta al più il cuore interno, senza il contenitore.
    const nested = sanitizeSlideTitle(
      '<a href="javascript:alert(1)"><i class="fa-heart"></i></a><i class="fa-heart"><i class="fa-heart"></i></i>',
    );
    expect(nested).toBe(
      '<i class="blk-slide-icon-heart" aria-hidden="true"></i><i class="blk-slide-icon-heart" aria-hidden="true"></i>',
    );
    expect(sanitizeSlideTitle('<i class="fa-heart"><img src=x onerror="alert(1)"></i>')).toBe('');
  });

  it('toglie script, gestori, style e collegamenti pericolosi', () => {
    const html = sanitizeSlideTitle(
      '<script>alert(1)</script><img src=x onerror="alert(2)"><span style="x:y" onclick="z()">Testo</span>' +
        '<a href="javascript:alert(3)">Link</a><style>b{}</style>',
    );
    expect(html).not.toMatch(/script|onerror|onclick|style|javascript|<a|<img/i);
    expect(html).not.toContain('alert');
    expect(html).toContain('Testo');
    expect(html).toContain('Link');
  });

  it('esce con i caratteri speciali del testo protetti', () => {
    expect(sanitizeSlideTitle('a &lt;b&gt; &amp; c')).toBe('a &lt;b&gt; &amp; c');
  });

  it('è un punto fisso', () => {
    const once = sanitizeSlideTitle(IMPORTED);
    expect(sanitizeSlideTitle(once)).toBe(once);
  });
});

describe('titolo di una slide: testo senza tag (alt e editor)', () => {
  it('dà il testo con gli a capo come spazi', () => {
    expect(slideTitleText(IMPORTED)).toBe('Famiglia in cammino');
  });

  it('non contiene markup né il contenuto di script', () => {
    const text = slideTitleText(
      '<script>alert(1)</script><b onclick="x">Ciao &amp; <i>mondo</i></b>',
    );
    expect(text).toBe('Ciao & mondo');
  });

  it('lascia invariato un titolo semplice', () => {
    expect(slideTitleText('Prima slide')).toBe('Prima slide');
  });

  // T2b: l'alt resta il testo senza icona, anche dal titolo già ripulito che la contiene.
  it('non mette l’icona nel testo', () => {
    expect(slideTitleText(sanitizeSlideTitle(IMPORTED))).toBe('Famiglia in cammino');
    expect(slideTitleEditText(sanitizeSlideTitle(IMPORTED))).toBe('Famiglia\nin cammino');
  });
});

describe('titolo di una slide: giro 1 della revisione T2', () => {
  // M1: sul sito l'alt nasce dal titolo già ripulito, dove i blocchi sono `span`.
  it('l’alt separa con uno spazio i blocchi del titolo già ripulito', () => {
    expect(slideTitleText(sanitizeSlideTitle('<div>Famiglia</div><div>in cammino</div>'))).toBe(
      'Famiglia in cammino',
    );
  });

  // M3: `text-align` si riconosce anche fra altre dichiarazioni, sempre solo left/center/right.
  it('riconosce text-align fra altre regole dello stile', () => {
    expect(sanitizeSlideTitle('<p style="color: red; text-align: center">A</p>')).toContain(
      'blk-slide-align-center',
    );
    expect(sanitizeSlideTitle('<p style="TEXT-ALIGN:Right;color:red">A</p>')).toContain(
      'blk-slide-align-right',
    );
    expect(sanitizeSlideTitle('<p style="color: red; text-align: justify">A</p>')).not.toContain(
      'blk-slide-align',
    );
    expect(sanitizeSlideTitle('<p style="x-text-align: center">A</p>')).not.toContain(
      'blk-slide-align',
    );
  });

  // I1: l'editor mostra il titolo su più righe e al salvataggio ricostruisce a capo e allineamento.
  it('per l’editor dà il testo con gli a capo come righe', () => {
    expect(slideTitleEditText(IMPORTED)).toBe('Famiglia\nin cammino');
    expect(slideTitleEditText('<div>A</div><div>B</div>')).toBe('A\nB');
    expect(slideTitleEditText('Prima &amp; slide')).toBe('Prima & slide');
  });

  it('legge l’allineamento del primo blocco, anche dal titolo già ripulito', () => {
    expect(slideTitleAlignment(IMPORTED)).toBe('center');
    expect(slideTitleAlignment(sanitizeSlideTitle(IMPORTED))).toBe('center');
    expect(slideTitleAlignment('<p style="color: red; text-align: right">A</p>')).toBe('right');
    expect(slideTitleAlignment('Senza blocchi')).toBeNull();
  });

  it('ricostruisce il titolo dal testo con a capo, allineamento e caratteri protetti', () => {
    const html = slideTitleFromText('Famiglia\nin viaggio <script>x</script>', 'center');
    expect(html).toBe(
      '<div align="center">Famiglia<br>in viaggio &lt;script&gt;x&lt;/script&gt;</div>',
    );
    const shown = sanitizeSlideTitle(html);
    expect(shown).toContain('blk-slide-align-center');
    expect(shown).toContain('<br>');
    expect(shown).not.toContain('<script');
    expect(slideTitleEditText(html)).toBe('Famiglia\nin viaggio <script>x</script>');
    expect(slideTitleFromText('Una riga', null)).toBe('Una riga');
    expect(slideTitleFromText('  \n ', 'center')).toBe('');
  });
});

describe('titolo di una slide: icona e testo semplice nell’editor (T2b)', () => {
  // Osservazione della ri-revisione T2: modificando un titolo formattato il cuore non si perde.
  it('legge le icone ammesse del titolo, dall’originale o dal titolo già ripulito', () => {
    expect(slideTitleIcons(IMPORTED)).toEqual(['heart']);
    expect(slideTitleIcons(sanitizeSlideTitle(IMPORTED))).toEqual(['heart']);
    expect(slideTitleIcons('<i class="fa-star"></i><i class="fa-heart" onclick="x"></i>')).toEqual(
      [],
    );
    expect(slideTitleIcons('Senza icone')).toEqual([]);
  });

  it('ricostruisce il titolo rimettendo le icone in coda', () => {
    expect(slideTitleFromText('Famiglie\nin viaggio', 'center', ['heart'])).toBe(
      '<div align="center">Famiglie<br>in viaggio <i class="fa-heart"></i></div>',
    );
    expect(slideTitleFromText('Una riga', null, ['heart'])).toBe(
      'Una riga <i class="fa-heart"></i>',
    );
    expect(slideTitleFromText(' ', 'center', ['heart'])).toBe('');
    const shown = sanitizeSlideTitle(slideTitleFromText('A', 'center', ['heart']));
    expect(shown).toContain('<i class="blk-slide-icon-heart" aria-hidden="true"></i>');
  });

  // Ri-revisione T2: un titolo semplice si riconosce anche con entità, e solo il markup lo rende formattato.
  it('distingue il titolo con markup da quello di solo testo', () => {
    expect(slideTitleHasMarkup('Prima slide')).toBe(false);
    expect(slideTitleHasMarkup('a &lt;b&gt; &amp; c')).toBe(false);
    expect(slideTitleHasMarkup('a <b>')).toBe(true);
    expect(slideTitleHasMarkup(IMPORTED)).toBe(true);
    expect(slideTitleHasMarkup('a <!-- x --> b')).toBe(true);
  });
});
