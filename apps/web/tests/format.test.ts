import { describe, expect, it } from 'vitest';
import { postDate } from '../src/lib/format';
import { featuredImageAttributes } from '../src/lib/featured';

/** Presentazione dell'archivio come il tema Divi della sorgente (1E-W6). Dati sintetici. */

describe('postDate', () => {
  it('scrive il giorno senza zero davanti, come il tema («7 Ott 2022»)', () => {
    expect(postDate('2022-10-07T10:00:00Z')).toBe('7 Ott 2022');
  });
});

describe('featuredImageAttributes — ritaglio 1080×675 di Divi', () => {
  const variants = [
    { publicPath: '/media/a-150x150.jpg', width: 150, height: 150 },
    { publicPath: '/media/a-480x679.jpg', width: 480, height: 679 },
    { publicPath: '/media/a-620x675.jpg', width: 620, height: 675 },
  ];

  it('originale più piccolo: il ritaglio è min(larghezza, 1080) × min(altezza, 675), più la variante a 480', () => {
    const attrs = featuredImageAttributes({
      publicPath: '/media/a.jpg',
      width: 620,
      height: 877,
      altText: null,
      variants,
    });
    expect(attrs).toEqual({
      src: '/media/a-620x675.jpg',
      width: 1080,
      height: 675,
      srcSet: '/media/a-620x675.jpg 1080w, /media/a-480x679.jpg 480w',
      sizes: '(min-width: 0px) and (max-width: 480px) 480px, (min-width: 481px) 1080px, 100vw',
    });
  });

  it('senza il ritaglio usa l’originale', () => {
    const attrs = featuredImageAttributes({
      publicPath: '/media/b.jpg',
      width: 800,
      height: 600,
      altText: null,
      variants: [],
    });
    expect(attrs.src).toBe('/media/b.jpg');
    expect(attrs.srcSet).toBeUndefined();
  });
});
