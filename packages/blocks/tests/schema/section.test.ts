import { describe, expect, it } from 'vitest';
import { sectionPropsSchema } from '../../src/schema/section.js';

describe('sectionPropsSchema', () => {
  it('accetta un caso valido e applica i predefiniti', () => {
    const parsed = sectionPropsSchema.parse({});
    expect(parsed.fullWidth).toBe(false);
    expect(parsed.parallax).toBe(false);
    expect(parsed.customWidth).toEqual({ mode: 'default', value: null });
    expect(parsed.padding).toEqual({ base: null, tablet: null, phone: null });
    expect(parsed.classes).toEqual([]);
  });

  it('accetta customWidth "px" con un valore positivo', () => {
    const parsed = sectionPropsSchema.parse({ customWidth: { mode: 'px', value: 960 } });
    expect(parsed.customWidth).toEqual({ mode: 'px', value: 960 });
  });

  it('rifiuta customWidth "px" senza valore (§3.1, vincolo Zod)', () => {
    expect(() => sectionPropsSchema.parse({ customWidth: { mode: 'px', value: null } })).toThrow();
  });

  it('rifiuta customWidth "default" con un valore', () => {
    expect(() => sectionPropsSchema.parse({ customWidth: { mode: 'default', value: 10 } })).toThrow();
  });

  it('rifiuta un colore fuori dalle due forme ammesse', () => {
    expect(() => sectionPropsSchema.parse({ backgroundColor: 'blue' })).toThrow();
  });

  it('accetta un colore esadecimale e uno rgba', () => {
    expect(sectionPropsSchema.parse({ backgroundColor: '#FFF' }).backgroundColor).toBe('#FFF');
    expect(sectionPropsSchema.parse({ backgroundColor: 'rgba(0, 0, 0, 0.5)' }).backgroundColor).toBe(
      'rgba(0, 0, 0, 0.5)',
    );
  });

  it('rifiuta una classe fuori dal vocabolario chiuso (§7.2)', () => {
    expect(() => sectionPropsSchema.parse({ classes: ['made-up-class'] })).toThrow();
  });

  it('rifiuta una chiave sconosciuta: oggetto strict (§1, regola 3)', () => {
    expect(() => sectionPropsSchema.parse({ notARealField: true })).toThrow();
  });

  it('rifiuta un backgroundMediaId che non è un uuid', () => {
    expect(() => sectionPropsSchema.parse({ backgroundMediaId: 'not-a-uuid' })).toThrow();
  });
});
