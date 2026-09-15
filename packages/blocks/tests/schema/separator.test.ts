import { describe, expect, it } from 'vitest';
import { separatorPropsSchema } from '../../src/schema/separator.js';

describe('separatorPropsSchema', () => {
  it('accetta un caso valido e applica il predefinito', () => {
    expect(separatorPropsSchema.parse({}).style).toBe('default');
  });

  it('accetta gli stili ammessi', () => {
    expect(separatorPropsSchema.parse({ style: 'wide' }).style).toBe('wide');
    expect(separatorPropsSchema.parse({ style: 'dots' }).style).toBe('dots');
  });

  it('rifiuta uno stile fuori enum', () => {
    expect(() => separatorPropsSchema.parse({ style: 'thick' })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => separatorPropsSchema.parse({ extra: 1 })).toThrow();
  });
});
