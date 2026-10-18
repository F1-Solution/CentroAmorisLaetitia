import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attesoPer,
  campione,
  confrontoSimmetrico,
  normalizza,
  regoleDallaMatrice,
  slugStorici,
} from '../redirect';

/*
 * Regole del §10 di `visual-regression-plan.md` e del §3.2 del mapping: ogni
 * gruppo ha il proprio esito atteso, e il percorso dei media cambia da
 * `/wp-content/uploads/` a `/media/` per ADR-004 e DR-034. Le righe sono prese
 * dalla matrice reale (indirizzi pubblici, nessun dato personale).
 */
describe('attesoPer', () => {
  it('pagina allegato: 301 verso il file, con /wp-content/uploads/ tradotto in /media/', () => {
    const e = attesoPer({
      origine: '/coppia/',
      gruppo: 'allegato',
      destinazioneSorgente: '/wp-content/uploads/2020/02/coppia.jpg',
    });
    assert.deepEqual(e, { stato: 301, destinazione: '/media/2020/02/coppia.jpg' });
  });

  it('pagina allegato con caratteri codificati: la destinazione si confronta decodificata', () => {
    const e = attesoPer({
      origine: '/corso_affettivita_2019/',
      gruppo: 'allegato',
      destinazioneSorgente: '/wp-content/uploads/2018/10/Corso_affettivit%C3%A0_2019.png',
    });
    assert.equal(e.destinazione, '/media/2018/10/Corso_affettività_2019.png');
  });

  it('documento scaricabile: 301 verso /download/<slug>/', () => {
    const e = attesoPer({
      origine: '/modulo-per-consulenze/',
      gruppo: 'download',
      destinazioneSorgente: '/download/modulo-per-consulenze/',
    });
    assert.deepEqual(e, { stato: 301, destinazione: '/download/modulo-per-consulenze/' });
  });

  it('slug storico: 301 verso il contenuto attuale', () => {
    const e = attesoPer({
      origine: '/472-2/',
      gruppo: 'slug storico',
      destinazioneSorgente: '/inizia-il-lungo-viaggio/',
    });
    assert.deepEqual(e, { stato: 301, destinazione: '/inizia-il-lungo-viaggio/' });
  });

  it('percorso storico di un file: 301 verso lo stesso file sotto /media/', () => {
    const e = attesoPer({
      origine: '/wp-content/uploads/2017/09/mani.jpg',
      gruppo: 'prefisso',
      destinazioneSorgente: '',
    });
    assert.deepEqual(e, { stato: 301, destinazione: '/media/2017/09/mani.jpg' });
  });

  it('allegato con lo stesso percorso di un articolo pubblicato: vince l articolo, 200', () => {
    const e = attesoPer({
      origine: '/pronti-a-ripartire/',
      gruppo: 'allegato oscurato',
      destinazioneSorgente: '',
    });
    assert.deepEqual(e, { stato: 200, destinazione: '' });
  });
});

describe('normalizza', () => {
  it('toglie l origine e decodifica i caratteri', () => {
    assert.equal(
      normalizza('http://127.0.0.1:3200/media/2018/10/Corsi_genitorialit%C3%A0_2019.png'),
      '/media/2018/10/Corsi_genitorialità_2019.png',
    );
  });

  it('una sequenza non decodificabile resta com è invece di far fallire la verifica', () => {
    assert.equal(normalizza('/media/100%-vero.jpg'), '/media/100%-vero.jpg');
  });
});

describe('regoleDallaMatrice', () => {
  const riga = (url: string, tipo: string, stato: string, destinazione = '') => ({
    url,
    tipo,
    stato_misurato: stato,
    destinazione_redirect: destinazione,
  });

  it('allegati e documenti diventano regole; le pagine no', () => {
    const regole = regoleDallaMatrice([
      riga('/coppia/', 'attachment', '301', '/wp-content/uploads/2020/02/coppia.jpg'),
      riga('/modulo-per-consulenze/', 'wpdmpro', '301', '/download/modulo-per-consulenze/'),
      riga('/pronti-a-ripartire/', 'attachment', '200'),
      riga('/chi-siamo/', 'page', '200'),
    ]);
    assert.deepEqual(
      regole.map((r) => [r.origine, r.gruppo]),
      [
        ['/coppia/', 'allegato'],
        ['/modulo-per-consulenze/', 'download'],
        ['/pronti-a-ripartire/', 'allegato oscurato'],
      ],
    );
  });
});

describe('slugStorici', () => {
  it('legge la tabella del §3.3 del mapping', () => {
    const md = [
      '| Vecchio percorso | Risposta misurata | Destinazione |',
      '|---|---|---|',
      '| `/convegno-25-novembre/` | **301** | `/convegno-26-novembre/` |',
      '| `/472-2/` | **301** | `/inizia-il-lungo-viaggio/` |',
      '',
      '| `/altro/` | `exact` | `/no/` |',
    ].join('\n');
    assert.deepEqual(
      slugStorici(md).map((r) => [r.origine, r.destinazioneSorgente, r.gruppo]),
      [
        ['/convegno-25-novembre/', '/convegno-26-novembre/', 'slug storico'],
        ['/472-2/', '/inizia-il-lungo-viaggio/', 'slug storico'],
      ],
    );
  });
});

describe('campione', () => {
  const elenco = Array.from({ length: 50 }, (_, i) => `f${i}`);

  it('con lo stesso seme sceglie gli stessi elementi', () => {
    assert.deepEqual(campione(elenco, 20, 7), campione(elenco, 20, 7));
  });

  it('sceglie n elementi distinti presi dall elenco', () => {
    const scelti = campione(elenco, 20, 7);
    assert.equal(scelti.length, 20);
    assert.equal(new Set(scelti).size, 20);
    for (const s of scelti) assert.ok(elenco.includes(s));
  });

  it('con un seme diverso la scelta cambia', () => {
    assert.notDeepEqual(campione(elenco, 20, 7), campione(elenco, 20, 8));
  });

  it('non modifica l elenco di partenza', () => {
    const copia = [...elenco];
    campione(elenco, 20, 7);
    assert.deepEqual(elenco, copia);
  });
});

describe('confrontoSimmetrico', () => {
  it('un 200 della matrice che risponde 3xx è un inversione', () => {
    assert.equal(confrontoSimmetrico(200, 301), 'inversione 200 → 3xx');
    assert.equal(confrontoSimmetrico(200, 308), 'inversione 200 → 3xx');
  });

  it('un 301 della matrice che risponde 200 è un inversione', () => {
    assert.equal(confrontoSimmetrico(301, 200), 'inversione 301 → 200');
  });

  it('stesso stato, o stati fuori dal controllo simmetrico: nessuna inversione', () => {
    assert.equal(confrontoSimmetrico(200, 200), null);
    assert.equal(confrontoSimmetrico(301, 301), null);
    assert.equal(confrontoSimmetrico(301, 404), null);
  });
});
