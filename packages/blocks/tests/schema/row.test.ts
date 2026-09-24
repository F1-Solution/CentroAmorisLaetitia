import { describe, expect, it } from 'vitest';
import { rowPropsSchema } from '../../src/schema/row.js';

describe('rowPropsSchema', () => {
  it('accetta un caso valido', () => {
    const parsed = rowPropsSchema.parse({ columnStructure: '1_2,1_2' });
    expect(parsed.columnStructure).toBe('1_2,1_2');
    expect(parsed.gutter).toEqual({ custom: false, width: null });
    expect(parsed.fullWidth).toBe(false);
  });

  it('rifiuta columnStructure obbligatoria assente', () => {
    expect(() => rowPropsSchema.parse({})).toThrow();
  });

  it('rifiuta una columnStructure con una forma non ammessa', () => {
    expect(() => rowPropsSchema.parse({ columnStructure: '1-2' })).toThrow();
    expect(() => rowPropsSchema.parse({ columnStructure: 'uno_due' })).toThrow();
  });

  it('accetta una columnStructure a più segmenti', () => {
    expect(rowPropsSchema.parse({ columnStructure: '1_3,1_3,1_3' }).columnStructure).toBe(
      '1_3,1_3,1_3',
    );
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => rowPropsSchema.parse({ columnStructure: '1_2,1_2', extra: 1 })).toThrow();
  });
});
