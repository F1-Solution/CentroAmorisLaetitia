import { describe, expect, it } from 'vitest';
import { phpUnserialize, phpValueToJson, PhpUnserializeError } from '../../src/source/php/unserialize.js';

describe('lettore del formato serializzato di PHP', () => {
  it('legge N; come null', () => {
    expect(phpUnserialize('N;')).toBeNull();
  });

  it('legge b: come booleano', () => {
    expect(phpUnserialize('b:1;')).toBe(true);
    expect(phpUnserialize('b:0;')).toBe(false);
  });

  it('legge i: come intero', () => {
    expect(phpUnserialize('i:42;')).toBe(42);
    expect(phpUnserialize('i:-7;')).toBe(-7);
  });

  it('legge d: come numero a virgola mobile', () => {
    expect(phpUnserialize('d:3.14;')).toBeCloseTo(3.14);
  });

  it('legge s: usando la lunghezza in BYTE, non in caratteri', () => {
    // "città" ha 5 caratteri ma 6 byte in UTF-8 (la 'à' ne vale 2).
    const value = phpUnserialize('s:6:"città";');
    expect(value).toBe('città');
  });

  it('legge una stringa con emoji a quattro byte, con la lunghezza in byte corretta', () => {
    const value = phpUnserialize('s:4:"🎉";');
    expect(value).toBe('🎉');
  });

  it('legge un array indicizzato come sequenza', () => {
    const value = phpUnserialize('a:2:{i:0;s:3:"uno";i:1;s:3:"due";}');
    expect(phpValueToJson(value)).toEqual(['uno', 'due']);
  });

  it('legge un array associativo come oggetto', () => {
    const value = phpUnserialize('a:2:{s:4:"nome";s:5:"Prova";s:3:"eta";i:30;}');
    expect(phpValueToJson(value)).toEqual({ nome: 'Prova', eta: 30 });
  });

  it('legge un array annidato', () => {
    const value = phpUnserialize(
      'a:1:{s:5:"width";a:2:{s:4:"unit";s:2:"px";s:5:"value";i:10;}}',
    );
    expect(phpValueToJson(value)).toEqual({ width: { unit: 'px', value: 10 } });
  });

  it('rifiuta un oggetto O: con un errore esplicito, non lo interpreta alla cieca', () => {
    expect(() => phpUnserialize('O:8:"stdClass":0:{}')).toThrow(PhpUnserializeError);
  });

  it('segnala un testo in eccesso dopo il valore', () => {
    expect(() => phpUnserialize('N;altro')).toThrow(PhpUnserializeError);
  });

  it('segnala un marcatore non riconosciuto', () => {
    expect(() => phpUnserialize('Q:1;')).toThrow(PhpUnserializeError);
  });
});
