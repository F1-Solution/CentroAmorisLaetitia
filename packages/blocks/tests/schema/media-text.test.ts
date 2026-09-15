import { describe, expect, it } from 'vitest';
import { mediaTextPropsSchema } from '../../src/schema/media-text.js';

describe('mediaTextPropsSchema', () => {
  it('accetta un caso valido con i predefiniti', () => {
    const parsed = mediaTextPropsSchema.parse({});
    expect(parsed.mediaPosition).toBe('left');
    expect(parsed.verticalAlignment).toBe('center');
    expect(parsed.mediaWidthPercent).toBeNull();
  });

  it('accetta mediaWidthPercent nei limiti 1..99', () => {
    expect(mediaTextPropsSchema.parse({ mediaWidthPercent: 50 }).mediaWidthPercent).toBe(50);
  });

  it('rifiuta mediaWidthPercent fuori dai limiti', () => {
    expect(() => mediaTextPropsSchema.parse({ mediaWidthPercent: 0 })).toThrow();
    expect(() => mediaTextPropsSchema.parse({ mediaWidthPercent: 100 })).toThrow();
  });

  it('rifiuta mediaPosition fuori enum', () => {
    expect(() => mediaTextPropsSchema.parse({ mediaPosition: 'center' })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => mediaTextPropsSchema.parse({ extra: 1 })).toThrow();
  });
});
