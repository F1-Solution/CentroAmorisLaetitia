import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEDIA_LIMITS,
  MEDIA_RULES,
  allowedTypesText,
  extensionOf,
  formatMegabytes,
  mediaMessages,
  mediaRules,
  ruleForMime,
} from '../src/index.js';

describe('elenco dei tipi ammessi (D147-A)', () => {
  it('ammette JPEG, PNG, WebP, PDF e MP4 e nient’altro', () => {
    expect(MEDIA_RULES.map((rule) => rule.mime)).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'video/mp4',
    ]);
    expect(ruleForMime('image/svg+xml')).toBeUndefined();
    expect(ruleForMime('text/html')).toBeUndefined();
  });

  it('applica i limiti predefiniti e li lascia abbassare', () => {
    expect(ruleForMime('image/png')).toMatchObject({
      maxBytes: 20 * 1024 * 1024,
      maxPixels: 50_000_000,
      derivatives: true,
    });
    expect(ruleForMime('application/pdf')?.maxPixels).toBeUndefined();
    expect(ruleForMime('video/mp4')?.maxBytes).toBe(100 * 1024 * 1024);
    const low = mediaRules({ ...DEFAULT_MEDIA_LIMITS, imageBytes: 10 });
    expect(ruleForMime('image/jpeg', low)?.maxBytes).toBe(10);
  });

  it('legge l’estensione in minuscolo', () => {
    expect(extensionOf('Foto.JPG')).toBe('jpg');
    expect(extensionOf('senza-estensione')).toBe('');
  });

  it('scrive i messaggi in italiano, con tipi e limiti', () => {
    expect(allowedTypesText()).toBe('JPEG, PNG, WebP, PDF e MP4');
    expect(formatMegabytes(20 * 1024 * 1024)).toBe('20 MB');
    expect(mediaMessages.typeNotAllowed('a.svg')).toContain('JPEG, PNG, WebP, PDF e MP4');
    expect(mediaMessages.tooLarge('a.pdf', ruleForMime('application/pdf')!)).toContain('20 MB');
  });
});
