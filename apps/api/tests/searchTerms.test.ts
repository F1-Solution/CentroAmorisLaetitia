import { describe, expect, it } from 'vitest';
import { parseSearch } from '../src/modules/public/search.js';

/**
 * La ricerca del sito pubblico (DR-144) scompone la frase come `WP_Query::parse_search()`
 * della sorgente: stessi separatori, stesse virgolette, stesse parole vuote
 * italiane, frase intera quando non resta nulla o i termini sono più di 9.
 */

describe('scomposizione della frase di ricerca (DR-144)', () => {
  it('una parola sola è un termine', () => {
    expect(parseSearch('corso')).toEqual({ terms: ['corso'], count: 1, sentence: 'corso' });
  });

  it('separa su spazi, tabulazioni, virgole e più', () => {
    expect(parseSearch('corso consulenti,famiglia+coppia').terms).toEqual([
      'corso',
      'consulenti',
      'famiglia',
      'coppia',
    ]);
  });

  it('tiene insieme il testo fra virgolette', () => {
    expect(parseSearch('"consulente familiare" corso').terms).toEqual([
      'consulente familiare',
      'corso',
    ]);
  });

  it('scarta le parole vuote italiane della traduzione di WordPress, senza badare alle maiuscole', () => {
    const parsed = parseSearch('Corso PER consulenti');
    expect(parsed.terms).toEqual(['Corso', 'consulenti']);
    // Il conteggio è quello prima dello scarto: decide l'ordine per pertinenza.
    expect(parsed.count).toBe(3);
  });

  it('scarta le lettere singole e i trattini isolati', () => {
    expect(parseSearch('a b corso -').terms).toEqual(['corso']);
  });

  it('se restano solo parole vuote cerca la frase intera', () => {
    expect(parseSearch('per il').terms).toEqual(['per il']);
  });

  it('oltre 9 termini cerca la frase intera', () => {
    const frase = 'due tre quattro cinque sei sette otto nove dieci undici';
    expect(parseSearch(frase).terms).toEqual([frase]);
  });

  it("il trattino iniziale resta sul termine: è un'esclusione", () => {
    expect(parseSearch('-corso famiglia').terms).toEqual(['-corso', 'famiglia']);
  });

  it('una frase vuota non ha termini', () => {
    expect(parseSearch('')).toEqual({ terms: [], count: 0, sentence: '' });
  });
});
