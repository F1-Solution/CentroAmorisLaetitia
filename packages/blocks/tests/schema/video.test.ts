import { describe, expect, it } from 'vitest';
import { deriveVideoProvider, videoPropsSchema } from '../../src/schema/video.js';

describe('videoPropsSchema', () => {
  it('accetta un caso valido', () => {
    const parsed = videoPropsSchema.parse({ src: 'https://youtu.be/xyz' });
    expect(parsed.provider).toBe('other'); // il provider non si deriva nello schema, solo si conserva
  });

  it('rifiuta src assente', () => {
    expect(() => videoPropsSchema.parse({})).toThrow();
  });

  it('rifiuta src vuoto', () => {
    expect(() => videoPropsSchema.parse({ src: '' })).toThrow();
  });

  it('rifiuta un provider fuori enum', () => {
    expect(() => videoPropsSchema.parse({ src: 'x', provider: 'dailymotion' })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => videoPropsSchema.parse({ src: 'x', extra: 1 })).toThrow();
  });
});

describe('deriveVideoProvider (§3.7.1)', () => {
  it('riconosce youtube.com e youtu.be', () => {
    expect(deriveVideoProvider('https://www.youtube.com/watch?v=abc')).toBe('youtube');
    expect(deriveVideoProvider('https://youtu.be/abc')).toBe('youtube');
  });

  it('riconosce vimeo.com', () => {
    expect(deriveVideoProvider('https://vimeo.com/12345')).toBe('vimeo');
  });

  it('riconosce un percorso /media/ come file', () => {
    expect(deriveVideoProvider('/media/2026/09/video.mp4')).toBe('file');
  });

  it('tutto il resto è "other"', () => {
    expect(deriveVideoProvider('https://example.com/video')).toBe('other');
    expect(deriveVideoProvider('non-un-url')).toBe('other');
  });
});
