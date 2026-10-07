import { describe, expect, it } from 'vitest';
import { dropZoneFor } from '../src/editor/dropZone';

describe('dropZoneFor (DR-084)', () => {
  it('divide la riga in tre fasce quando l’elemento accetta figli', () => {
    expect(dropZoneFor(5, 40, true)).toBe('before');
    expect(dropZoneFor(20, 40, true)).toBe('inside');
    expect(dropZoneFor(35, 40, true)).toBe('after');
  });

  it('i confini stanno a un quarto e a tre quarti', () => {
    expect(dropZoneFor(9.9, 40, true)).toBe('before');
    expect(dropZoneFor(10, 40, true)).toBe('inside');
    expect(dropZoneFor(29.9, 40, true)).toBe('inside');
    expect(dropZoneFor(30, 40, true)).toBe('after');
  });

  it('senza figli ammessi la riga ha due sole metà, e mai «dentro»', () => {
    expect(dropZoneFor(19.9, 40, false)).toBe('before');
    expect(dropZoneFor(20, 40, false)).toBe('after');
  });

  it('fuori dalla riga resta nella fascia più vicina', () => {
    expect(dropZoneFor(-3, 40, true)).toBe('before');
    expect(dropZoneFor(55, 40, true)).toBe('after');
  });
});
