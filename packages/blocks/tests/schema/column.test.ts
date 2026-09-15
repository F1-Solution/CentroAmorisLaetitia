import { describe, expect, it } from 'vitest';
import { columnPropsSchema } from '../../src/schema/column.js';

describe('columnPropsSchema', () => {
  it('accetta un caso valido', () => {
    expect(columnPropsSchema.parse({ width: '1_2' }).width).toBe('1_2');
  });

  it('rifiuta width obbligatoria assente', () => {
    expect(() => columnPropsSchema.parse({})).toThrow();
  });

  it('rifiuta una width con una forma non ammessa', () => {
    expect(() => columnPropsSchema.parse({ width: 'metà' })).toThrow();
    expect(() => columnPropsSchema.parse({ width: '1/2' })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => columnPropsSchema.parse({ width: '1_2', extra: 1 })).toThrow();
  });
});
