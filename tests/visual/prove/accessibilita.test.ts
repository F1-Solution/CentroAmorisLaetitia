import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { etichettaMancante, inversioniOrdine, saltiTitoli } from '../accessibilita';
import { classificaContrasto, componi, contrasto, testoGrande } from '../contrasto';

/*
 * Funzioni pure della T4 (A-2, A-5, A-7) e della T6 (A-8) della `1E-W7`.
 * Coordinate e colori inventati, salvo le due coppie di DR-115.
 */
describe('inversioniOrdine (A-2)', () => {
  it('alto→basso e sinistra→destra per riga: nessuna inversione', () => {
    assert.deepEqual(
      inversioniOrdine([
        { x: 10, y: 10 },
        { x: 100, y: 12 },
        { x: 10, y: 60 },
        { x: 50, y: 200 },
      ]),
      [],
    );
  });

  it('un elemento più in alto del precedente oltre la tolleranza è un inversione', () => {
    assert.deepEqual(
      inversioniOrdine([
        { x: 10, y: 300 },
        { x: 10, y: 100 },
      ]),
      [1],
    );
  });

  it('nella stessa riga, tornare a sinistra è un inversione', () => {
    assert.deepEqual(
      inversioniOrdine([
        { x: 200, y: 10 },
        { x: 50, y: 14 },
      ]),
      [1],
    );
  });
});

describe('saltiTitoli (A-7)', () => {
  it('h1 h2 h3 h2: nessun salto', () => {
    assert.deepEqual(saltiTitoli([1, 2, 3, 2]), []);
  });

  it('h2 → h4 è un salto di due livelli', () => {
    assert.deepEqual(saltiTitoli([1, 2, 4]), ['h2→h4']);
  });

  it('il primo titolo non è h1: salto dalla radice', () => {
    assert.deepEqual(saltiTitoli([3]), ['inizio→h3']);
  });

  it('salire di più livelli è ammesso', () => {
    assert.deepEqual(saltiTitoli([1, 2, 3, 4, 2]), []);
  });
});

describe('etichettaMancante (A-5)', () => {
  it('label[for], label che contiene, aria-label, aria-labelledby bastano', () => {
    assert.equal(
      etichettaMancante({
        labelFor: true,
        labelContenitore: false,
        ariaLabel: '',
        ariaLabelledby: '',
      }),
      false,
    );
    assert.equal(
      etichettaMancante({
        labelFor: false,
        labelContenitore: true,
        ariaLabel: '',
        ariaLabelledby: '',
      }),
      false,
    );
    assert.equal(
      etichettaMancante({
        labelFor: false,
        labelContenitore: false,
        ariaLabel: 'Nome',
        ariaLabelledby: '',
      }),
      false,
    );
    assert.equal(
      etichettaMancante({
        labelFor: false,
        labelContenitore: false,
        ariaLabel: '',
        ariaLabelledby: 'x',
      }),
      false,
    );
  });

  it('solo il segnaposto non basta', () => {
    assert.equal(
      etichettaMancante({
        labelFor: false,
        labelContenitore: false,
        ariaLabel: '  ',
        ariaLabelledby: '',
      }),
      true,
    );
  });
});

describe('contrasto (A-8)', () => {
  it('nero su bianco = 21', () => {
    assert.equal(contrasto('rgb(0, 0, 0)', 'rgb(255, 255, 255)'), 21);
  });

  it('#777 su bianco ≈ 4,48', () => {
    assert.equal(contrasto('#777', '#fff'), 4.48);
  });

  it("l'ordine dei colori non conta", () => {
    assert.equal(contrasto('#fff', '#777'), 4.48);
  });

  it('le due coppie di DR-115', () => {
    assert.equal(contrasto('#2ea3f2', '#fff'), 2.75);
    assert.equal(contrasto('#999', '#eee'), 2.46);
  });
});

describe('componi', () => {
  it('un colore semitrasparente si fonde sullo sfondo', () => {
    assert.equal(componi('rgba(0, 0, 0, 0.5)', 'rgb(255, 255, 255)'), 'rgb(128, 128, 128)');
  });

  it('un colore opaco resta com è', () => {
    assert.equal(componi('rgb(10, 20, 30)', 'rgb(255, 255, 255)'), 'rgb(10, 20, 30)');
  });
});

describe('testoGrande', () => {
  it('24 px normale, 18,66 px grassetto (WCAG)', () => {
    assert.equal(testoGrande(24, 400), true);
    assert.equal(testoGrande(23, 400), false);
    assert.equal(testoGrande(19, 700), true);
    assert.equal(testoGrande(18, 700), false);
  });
});

describe('classificaContrasto', () => {
  it('conforme sopra 4,5 (3 per testo grande)', () => {
    assert.equal(classificaContrasto('#666', '#fff', false), 'conforme');
    assert.equal(classificaContrasto('#2ea3f2', '#fff', true), 'non conforme già decisa da DR-115');
    assert.equal(classificaContrasto('#8a8a8a', '#fff', true), 'conforme');
  });

  it('le coppie di DR-115 sono già decise', () => {
    assert.equal(
      classificaContrasto('rgb(46, 163, 242)', 'rgb(255, 255, 255)', false),
      'non conforme già decisa da DR-115',
    );
    assert.equal(classificaContrasto('#999', '#eee', false), 'non conforme già decisa da DR-115');
  });

  it('ogni altra coppia sotto soglia è nuova', () => {
    assert.equal(classificaContrasto('#aaa', '#fff', false), 'non conforme nuova');
  });
});
