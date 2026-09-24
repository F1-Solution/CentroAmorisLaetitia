import { describe, expect, it } from 'vitest';
import { parseAttachmentMetadata } from '../../../src/stages/media/attachmentMetadata.js';

describe('parseAttachmentMetadata', () => {
  it('restituisce vuoto quando la chiave manca (5 allegati su 170 non ce l’hanno)', () => {
    expect(parseAttachmentMetadata(null)).toEqual({ width: null, height: null, variants: [] });
    expect(parseAttachmentMetadata('')).toEqual({ width: null, height: null, variants: [] });
  });

  it('accetta una dimensione derivata Divi con un nome che non è una delle quattro standard', () => {
    const file = 'prova-400x250.png';
    const mime = 'image/png';
    const raw =
      `a:3:{s:5:"width";i:619;s:6:"height";i:871;s:5:"sizes";a:1:{` +
      `s:21:"et-pb-post-main-image";a:4:{s:4:"file";s:${file.length}:"${file}";` +
      `s:5:"width";i:400;s:6:"height";i:250;s:9:"mime-type";s:${mime.length}:"${mime}";}}}`;

    const parsed = parseAttachmentMetadata(raw);
    expect(parsed.width).toBe(619);
    expect(parsed.height).toBe(871);
    expect(parsed.variants).toHaveLength(1);
    expect(parsed.variants[0]).toEqual({
      sizeName: 'et-pb-post-main-image',
      file: 'prova-400x250.png',
      width: 400,
      height: 250,
      mimeType: 'image/png',
    });
  });

  it('scarta una voce di dimensione incompleta invece di inventare i campi mancanti', () => {
    const raw =
      'a:2:{s:5:"width";i:100;s:5:"sizes";a:1:{s:9:"thumbnail";a:1:{s:4:"file";s:5:"x.jpg";}}}';
    const parsed = parseAttachmentMetadata(raw);
    expect(parsed.variants).toHaveLength(0);
  });

  it('un file senza il livello "sizes" (per esempio un PDF senza anteprima) non produce varianti', () => {
    const raw = 'a:0:{}';
    expect(parseAttachmentMetadata(raw)).toEqual({ width: null, height: null, variants: [] });
  });
});
