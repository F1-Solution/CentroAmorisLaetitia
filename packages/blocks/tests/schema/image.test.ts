import { describe, expect, it } from 'vitest';
import { imagePropsSchema } from '../../src/schema/image.js';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('imagePropsSchema', () => {
  it('accetta un caso valido con mediaId', () => {
    const parsed = imagePropsSchema.parse({ mediaId: uuid });
    expect(parsed.mediaId).toBe(uuid);
    expect(parsed.alt).toBe('');
    expect(parsed.lightbox).toBe(false);
  });

  it('accetta un caso valido con solo src', () => {
    expect(imagePropsSchema.parse({ src: '/media/2026/09/foto.jpg' }).src).toBe('/media/2026/09/foto.jpg');
  });

  it('rifiuta quando sia mediaId sia src sono nulli', () => {
    expect(() => imagePropsSchema.parse({})).toThrow();
  });

  it('rifiuta una variant con una forma non ammessa', () => {
    expect(() => imagePropsSchema.parse({ mediaId: uuid, variant: 'grande' })).toThrow();
  });

  it('accetta una variant nella forma "LxA"', () => {
    expect(imagePropsSchema.parse({ mediaId: uuid, variant: '640x480' }).variant).toBe('640x480');
  });

  it('rifiuta un align fuori enum', () => {
    expect(() => imagePropsSchema.parse({ mediaId: uuid, align: 'top' })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => imagePropsSchema.parse({ mediaId: uuid, extra: 1 })).toThrow();
  });
});
