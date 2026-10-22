import { describe, expect, it } from 'vitest';
import { archiveSummary, excerptLines, fileSize, longDate, postDate } from '../src/lib/format';
import { featuredImageAttributes } from '../src/lib/featured';

/** Presentazione dell'archivio come il tema Divi della sorgente (1E-W6). Dati sintetici. */

describe('postDate', () => {
  it('scrive il giorno senza zero davanti, come il tema («7 Ott 2022»)', () => {
    expect(postDate('2022-10-07T10:00:00Z')).toBe('7 Ott 2022');
  });
});

describe('featuredImageAttributes — ritaglio 1080×675 di Divi', () => {
  const variants = [
    { publicPath: '/media/a-150x150.jpg', width: 150, height: 150 },
    { publicPath: '/media/a-480x679.jpg', width: 480, height: 679 },
    { publicPath: '/media/a-620x675.jpg', width: 620, height: 675 },
  ];

  it('originale più piccolo: il ritaglio è min(larghezza, 1080) × min(altezza, 675), più la variante a 480', () => {
    const attrs = featuredImageAttributes({
      publicPath: '/media/a.jpg',
      width: 620,
      height: 877,
      altText: null,
      variants,
    });
    expect(attrs).toEqual({
      src: '/media/a-620x675.jpg',
      width: 1080,
      height: 675,
      srcSet: '/media/a-620x675.jpg 1080w, /media/a-480x679.jpg 480w',
      sizes: '(min-width: 0px) and (max-width: 480px) 480px, (min-width: 481px) 1080px, 100vw',
    });
  });

  it('originale grande: anche la variante a 980 px per il tablet, come la sorgente', () => {
    const attrs = featuredImageAttributes({
      publicPath: '/media/c.jpg',
      width: 2000,
      height: 2829,
      altText: null,
      variants: [
        { publicPath: '/media/c-1080x675.jpg', width: 1080, height: 675 },
        { publicPath: '/media/c-980x1386.jpg', width: 980, height: 1386 },
        { publicPath: '/media/c-480x679.jpg', width: 480, height: 679 },
      ],
    });
    expect(attrs).toEqual({
      src: '/media/c-1080x675.jpg',
      width: 1080,
      height: 675,
      srcSet: '/media/c-1080x675.jpg 1080w, /media/c-980x1386.jpg 980w, /media/c-480x679.jpg 480w',
      sizes:
        '(min-width: 0px) and (max-width: 480px) 480px, (min-width: 481px) and (max-width: 980px) 980px, (min-width: 981px) 1080px, 100vw',
    });
  });

  it('senza il ritaglio usa l’originale', () => {
    const attrs = featuredImageAttributes({
      publicPath: '/media/b.jpg',
      width: 800,
      height: 600,
      altText: null,
      variants: [],
    });
    expect(attrs.src).toBe('/media/b.jpg');
    expect(attrs.srcSet).toBeUndefined();
  });
});

describe('archiveSummary — `truncate_post(270)` di Divi (DR-151)', () => {
  const parole = (n: number) =>
    Array.from({ length: n }, (_, i) => `p${String(i).padStart(3, '0')}`).join(' ');

  it('testo corto: intero, senza puntini', () => {
    expect(archiveSummary('Un testo breve.')).toBe('Un testo breve.');
  });

  it('testo lungo: 270 caratteri, via l’ultima parola, poi «...»', () => {
    // 54 parole da 4 caratteri più gli spazi fanno 269: il 270° è uno spazio,
    // tolto da `rtrim`; poi la sorgente toglie comunque l'ultima parola.
    const out = archiveSummary(parole(80));
    expect(out).toBe(`${parole(53)}...`);
  });

  it('il taglio su uno spazio toglie comunque l’ultima parola intera', () => {
    // 54 parole = 269 caratteri, più lo spazio: il taglio a 270 cade sullo spazio.
    expect(archiveSummary(parole(80)).endsWith('p052...')).toBe(true);
  });

  it('le entità scritte per esteso contano per la loro lunghezza e si decodificano (D71)', () => {
    // `&#8217;` vale 7 e `&#x1f4cc;` 9, come nel testo contato dalla sorgente.
    const out = archiveSummary(`&#8217;&#x1f4cc; ${parole(80)}`);
    // Prefisso di 17 caratteri: 50 parole intere, poi «p05» tagliata e tolta.
    expect(out).toBe(`’📌 ${parole(50)}...`);
  });

  it('un carattere tipografico scritto dall’autore vale 1 (D71)', () => {
    const out = archiveSummary(`’ ${parole(80)}`);
    // Prefisso di 2 caratteri: 53 parole e mezza, l'ultima tolta.
    expect(out).toBe(`’ ${parole(53)}...`);
  });

  it('i puntini seguono i byte, come `strlen`: testo corto in caratteri ma lungo in byte', () => {
    // 200 caratteri «è» sono 400 byte: la sorgente aggiunge i puntini e toglie l'ultima parola.
    const testo = `${'è'.repeat(100)} ${'è'.repeat(99)}`;
    expect(archiveSummary(testo)).toBe(`${'è'.repeat(100)}...`);
  });
});

describe('scheda del pacchetto (D75)', () => {
  it('data lunga con il mese per intero, come date_format della sorgente', () => {
    expect(longDate('2022-04-05T10:00:00Z')).toBe('5 Aprile 2022');
    expect(longDate(null)).toBe('');
  });

  it('un’entità fuori da Unicode resta com’è e non ferma la pagina', () => {
    expect(archiveSummary('Prova &#99999999; e &#xD800;')).toBe('Prova &#99999999; e &#xD800;');
  });

  it('dimensione in base 1024 con due decimali', () => {
    expect(fileSize(103209)).toBe('100.79 KB');
    expect(fileSize(5 * 1024 * 1024)).toBe('5.00 MB');
    expect(fileSize(512)).toBe('512 B');
    expect(fileSize(1048575)).toBe('1.00 MB');
  });
});

describe('excerptLines: l’estratto intero in archivio e ricerca (D139 = B, S10)', () => {
  it('un estratto vuoto o di soli spazi non c’è', () => {
    expect(excerptLines('')).toBeNull();
    expect(excerptLines('  \n\t ')).toBeNull();
    expect(excerptLines('<b> </b>')).toBeNull();
  });

  it('il testo resta intero, senza taglio', () => {
    const lungo = Array.from({ length: 120 }, (_, i) => `parola${i}`).join(' ');
    expect(excerptLines(lungo)).toEqual([lungo]);
  });

  it('gli a capo separano le righe, in ogni forma', () => {
    expect(excerptLines('uno\ndue\r\ntre\rquattro')).toEqual(['uno', 'due', 'tre', 'quattro']);
  });

  it('i tag HTML si tolgono e ne resta il testo', () => {
    expect(
      excerptLines('Vai alla <a href="/x/" class="y">pagina</a> <strong>ora</strong>.'),
    ).toEqual(['Vai alla pagina ora.']);
  });

  it('le entità si decodificano dopo aver tolto i tag: un «<» scritto come entità resta testo', () => {
    expect(excerptLines('Rock &amp; roll, t&#232; &lt;b&gt; &#8217;')).toEqual([
      'Rock & roll, tè <b> ’',
    ]);
  });
});
