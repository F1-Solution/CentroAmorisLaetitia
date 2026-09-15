import { describe, expect, it } from 'vitest';
import { postListPropsSchema } from '../../src/schema/post-list.js';

describe('postListPropsSchema', () => {
  it('accetta un caso valido con i predefiniti', () => {
    const parsed = postListPropsSchema.parse({});
    expect(parsed.order).toBe('date_desc');
    expect(parsed.showThumbnail).toBe(true);
    expect(parsed.termIds).toEqual([]);
  });

  it('rifiuta limit fuori dai limiti 1..50', () => {
    expect(() => postListPropsSchema.parse({ limit: 0 })).toThrow();
    expect(() => postListPropsSchema.parse({ limit: 51 })).toThrow();
  });

  it('rifiuta order fuori enum', () => {
    expect(() => postListPropsSchema.parse({ order: 'random' })).toThrow();
  });

  it('rifiuta un termId non uuid', () => {
    expect(() => postListPropsSchema.parse({ termIds: ['non-uuid'] })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => postListPropsSchema.parse({ extra: 1 })).toThrow();
  });
});
