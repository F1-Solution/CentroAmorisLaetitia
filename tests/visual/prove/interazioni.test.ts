import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  chiaveImmagine,
  cls,
  confrontaImmagini,
  confrontaPassaggi,
  confrontaStili,
  esitoVoce,
  normalizzaColore,
  passaggi,
} from '../interazioni';

/*
 * Funzioni pure della T3 (`W7-PLAN.md` §4): stili di hover con tolleranza 0 sui
 * colori normalizzati, CLS, punti di rottura per D78 = A (DR-168) e confronto
 * delle immagini servite. Dati inventati: nessun contenuto del sito.
 */
describe('normalizzaColore', () => {
  it('esadecimale breve e lungo diventano rgb()', () => {
    assert.equal(normalizzaColore('#fff'), 'rgb(255, 255, 255)');
    assert.equal(normalizzaColore('#2EA3F2'), 'rgb(46, 163, 242)');
  });

  it('spazi e alfa 1 non contano', () => {
    assert.equal(normalizzaColore('rgb(1,2,3)'), 'rgb(1, 2, 3)');
    assert.equal(normalizzaColore('rgba(1, 2, 3, 1)'), 'rgb(1, 2, 3)');
  });

  it('alfa 0 è trasparente, qualunque sia il colore', () => {
    assert.equal(normalizzaColore('rgba(0, 0, 0, 0)'), 'transparent');
    assert.equal(normalizzaColore('rgba(255, 0, 0, 0)'), 'transparent');
  });

  it('alfa parziale resta rgba()', () => {
    assert.equal(normalizzaColore('rgba(0,0,0,0.5)'), 'rgba(0, 0, 0, 0.5)');
  });
});

describe('confrontaStili', () => {
  const base = {
    color: 'rgb(0, 0, 0)',
    'background-color': 'rgba(0, 0, 0, 0)',
    'text-decoration-line': 'none',
    opacity: '1',
    'border-color': 'rgb(0, 0, 0)',
  };

  it('stessi stili scritti in modo diverso: nessuna differenza', () => {
    assert.deepEqual(
      confrontaStili(base, { ...base, color: '#000', 'background-color': 'transparent' }),
      [],
    );
  });

  it("un colore diverso di un'unità è una differenza (tolleranza 0)", () => {
    assert.deepEqual(confrontaStili(base, { ...base, color: 'rgb(0, 0, 1)' }), [
      { proprieta: 'color', riferimento: 'rgb(0, 0, 0)', sito: 'rgb(0, 0, 1)' },
    ]);
  });

  it('opacità confrontata come numero', () => {
    assert.deepEqual(confrontaStili({ ...base, opacity: '0.8' }, { ...base, opacity: '.8' }), []);
    assert.equal(
      confrontaStili({ ...base, opacity: '0.8' }, { ...base, opacity: '0.7' }).length,
      1,
    );
  });
});

describe('cls', () => {
  it('somma gli spostamenti senza input recente', () => {
    assert.equal(
      cls([
        { value: 0.1, hadRecentInput: false },
        { value: 0.05, hadRecentInput: true },
        { value: 0.02, hadRecentInput: false },
      ]),
      0.12,
    );
  });

  it('nessun evento: 0', () => {
    assert.equal(cls([]), 0);
  });
});

describe('passaggi', () => {
  it('registra la prima larghezza, scendendo, in cui la firma cambia', () => {
    const p = passaggi([
      { larghezza: 1000, firma: 'desktop' },
      { larghezza: 990, firma: 'desktop' },
      { larghezza: 980, firma: 'mobile' },
      { larghezza: 970, firma: 'mobile' },
    ]);
    assert.deepEqual(p, [{ larghezza: 980, da: 'desktop', a: 'mobile' }]);
  });

  it('ordina per larghezza decrescente anche se i passi arrivano in disordine', () => {
    const p = passaggi([
      { larghezza: 970, firma: 'b' },
      { larghezza: 990, firma: 'a' },
      { larghezza: 980, firma: 'b' },
    ]);
    assert.deepEqual(p, [{ larghezza: 980, da: 'a', a: 'b' }]);
  });
});

describe('confrontaPassaggi', () => {
  const rif = [
    { larghezza: 980, da: 'desktop', a: 'mobile' },
    { larghezza: 760, da: 'mobile', a: 'stretto' },
  ];

  it('stessi passaggi alla stessa larghezza: nessuna differenza', () => {
    assert.deepEqual(confrontaPassaggi(rif, rif), []);
  });

  it('larghezza diversa di un passo (10 px): differenza', () => {
    const sito = [rif[0]!, { larghezza: 750, da: 'mobile', a: 'stretto' }];
    assert.deepEqual(confrontaPassaggi(rif, sito), [
      'mobile→stretto: riferimento 760 px, sito 750 px',
    ]);
  });

  it('passaggio mancante o in più', () => {
    assert.deepEqual(confrontaPassaggi(rif, [rif[0]!]), [
      'mobile→stretto: riferimento 760 px, sito assente',
    ]);
    assert.deepEqual(confrontaPassaggi([rif[0]!], rif), [
      'mobile→stretto: riferimento assente, sito 760 px',
    ]);
  });
});

describe('chiaveImmagine', () => {
  it('toglie percorso, dimensione generata ed estensione', () => {
    assert.equal(
      chiaveImmagine('http://x/wp-content/uploads/2020/02/Coppia-300x200.jpg'),
      'coppia',
    );
    assert.equal(chiaveImmagine('http://y/media/2020/02/coppia.webp?v=1'), 'coppia');
  });

  it('decodifica i caratteri', () => {
    assert.equal(
      chiaveImmagine('/media/2018/10/Corso_affettivit%C3%A0_2019-1024x576.png'),
      'corso_affettività_2019',
    );
  });
});

describe('confrontaImmagini', () => {
  it('confronta il file servito, non naturalWidth (che dipende da sizes)', () => {
    const esiti = confrontaImmagini(
      [
        { src: '/wp-content/uploads/a-480x480.jpg', naturalWidth: 480 },
        { src: '/wp-content/uploads/b-1024x576.jpg', naturalWidth: 1024 },
        { src: '/wp-content/uploads/c-300x200.jpg', naturalWidth: 300 },
        { src: '/wp-content/uploads/d.jpg', naturalWidth: 500 },
        { src: '/wp-content/uploads/f-768x400.jpg', naturalWidth: 768 },
      ],
      [
        { src: '/media/a-480x480.jpg', naturalWidth: 389 },
        { src: '/media/b-768x432.jpg', naturalWidth: 768 },
        { src: '/media/c.jpg', naturalWidth: 1200 },
        { src: '/media/e.jpg', naturalWidth: 100 },
        { src: '/media/f-1024x533.jpg', naturalWidth: 1024 },
      ],
    );
    assert.deepEqual(
      esiti.map((e) => [e.chiave, e.esito, e.riferimento, e.sito]),
      [
        ['a', 'uguale', 'a-480x480.jpg', 'a-480x480.jpg'],
        ['b', 'più piccola', 'b-1024x576.jpg', 'b-768x432.jpg'],
        ['c', 'più grande', 'c-300x200.jpg', 'c.jpg'],
        ['d', 'solo riferimento', 'd.jpg', null],
        ['f', 'più grande', 'f-768x400.jpg', 'f-1024x533.jpg'],
        ['e', 'solo sito', null, 'e.jpg'],
      ],
    );
  });
});

describe('esitoVoce', () => {
  it('superato se il sito supera, qualunque sia il riferimento', () => {
    assert.equal(esitoVoce(true, false), 'superato');
  });

  it('difetto presente anche nella sorgente: classificato a parte (D79, R7-2)', () => {
    assert.equal(esitoVoce(false, false), 'difetto anche nella sorgente');
  });

  it('non superato se solo il sito fallisce', () => {
    assert.equal(esitoVoce(false, true), 'non superato');
  });

  it('non applicabile quando la voce non esiste nella pagina', () => {
    assert.equal(esitoVoce(null, null), 'non applicabile');
  });
});
