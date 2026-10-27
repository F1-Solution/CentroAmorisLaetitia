import { describe, expect, it } from 'vitest';
import {
  deriveVideoProvider,
  normalizeYouTubeUrl,
  videoPropsSchema,
} from '../../src/schema/video.js';

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

/**
 * DR-279 (1G-W7, T2f): l'indirizzo YouTube scelto dall'editor. Solo YouTube, solo https, e
 * sempre ricondotto alla forma `watch?v=` che la resa del sito già sa incorporare: così
 * l'HTML del sito non cambia e nessun indirizzo libero arriva a un iframe.
 */
describe('normalizeYouTubeUrl (DR-279)', () => {
  const ID = 'aBcDeFgHi_-';
  const CANONICAL = `https://www.youtube.com/watch?v=${ID}`;

  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1`,
    `https://youtube-nocookie.com/embed/${ID}`,
    `  https://WWW.YOUTUBE.COM/watch?v=${ID}  `,
  ])('accetta %s e lo riconduce alla forma canonica', (input) => {
    expect(normalizeYouTubeUrl(input)).toBe(CANONICAL);
  });

  it('la forma canonica è un video YouTube per deriveVideoProvider', () => {
    expect(deriveVideoProvider(CANONICAL)).toBe('youtube');
  });

  it.each([
    ['http, non https', `http://www.youtube.com/watch?v=${ID}`],
    ['un altro host', `https://vimeo.com/12345`],
    ['un host che finge', `https://youtube.com.evil.example/watch?v=${ID}`],
    ['un sottodominio che finge', `https://evil.example/youtube.com/watch?v=${ID}`],
    ['javascript:', `javascript:alert(1)//youtube.com/watch?v=${ID}`],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['senza identificativo', 'https://www.youtube.com/watch'],
    ['identificativo malformato', 'https://youtu.be/abc'],
    ['credenziali', `https://utente@www.youtube.com/watch?v=${ID}`],
    ['porta', `https://www.youtube.com:8443/watch?v=${ID}`],
    ['un canale', 'https://www.youtube.com/@canale'],
    ['testo', 'non un indirizzo'],
    ['un percorso della libreria', '/media/2026/01/video.mp4'],
  ])('rifiuta %s', (_caso, input) => {
    expect(normalizeYouTubeUrl(input)).toBeNull();
  });
});
