import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlocksDocument } from '../../src/render/BlocksDocument.js';
import { imageAttributes, type MediaMap } from '../../src/render/media.js';
import { testBlockId } from '../helpers.js';
import type { BlockDocument } from '../../src/schema/document.js';

/**
 * Le immagini del sito pubblico: la mappa dei media della lettura pubblica
 * (DR-104) scende dal documento ai blocchi e dà `src`, `srcset`, dimensioni e
 * testo alternativo. Senza mappa, come nell'anteprima, resta il segnaposto.
 */

const MEDIA_ID = '22222222-2222-4222-8222-222222222222';
const media: MediaMap = {
  [MEDIA_ID]: {
    publicPath: '/media/2026/01/sintetica.png',
    width: 1200,
    height: 600,
    altText: 'Testo alternativo dall’archivio',
    variants: [
      { publicPath: '/media/2026/01/sintetica-300x150.png', width: 300, height: 150 },
      { publicPath: '/media/2026/01/sintetica-768x384.png', width: 768, height: 384 },
    ],
  },
};

function documentWithImage(mediaId: string, alt = ''): BlockDocument {
  return {
    schema: 1,
    blocks: [
      {
        type: 'image',
        id: testBlockId(),
        props: {
          mediaId,
          src: null,
          alt,
          caption: null,
          linkUrl: null,
          linkNewWindow: false,
          align: null,
          classes: [],
        },
        children: [],
      },
    ],
  } as unknown as BlockDocument;
}

describe('immagini risolte dalla mappa dei media', () => {
  it('src, srcset e sizes come li scrive WordPress', () => {
    expect(imageAttributes(media[MEDIA_ID]!)).toEqual({
      src: '/media/2026/01/sintetica.png',
      srcSet:
        '/media/2026/01/sintetica-300x150.png 300w, /media/2026/01/sintetica-768x384.png 768w, /media/2026/01/sintetica.png 1200w',
      sizes: '(max-width: 1200px) 100vw, 1200px',
      width: 1200,
      height: 600,
    });
  });

  it('famiglia K: i ritagli a proporzione diversa non entrano nel srcset, come wp_image_matches_ratio', () => {
    // Il caso misurato su /i-prossimi-corsi-del-centro/: originale 3744×5197.
    const portrait = {
      publicPath: '/media/a.jpg',
      width: 3744,
      height: 5197,
      altText: null,
      variants: [
        { publicPath: '/media/a-150x150.jpg', width: 150, height: 150 },
        { publicPath: '/media/a-216x300.jpg', width: 216, height: 300 },
        { publicPath: '/media/a-400x250.jpg', width: 400, height: 250 },
        { publicPath: '/media/a-400x284.jpg', width: 400, height: 284 },
        { publicPath: '/media/a-738x1024.jpg', width: 738, height: 1024 },
        { publicPath: '/media/a-1080x675.jpg', width: 1080, height: 675 },
        { publicPath: '/media/a-1080x1499.jpg', width: 1080, height: 1499 },
      ],
    };
    expect(imageAttributes(portrait).srcSet).toBe(
      '/media/a-216x300.jpg 216w, /media/a-738x1024.jpg 738w, /media/a-1080x1499.jpg 1080w, /media/a.jpg 3744w',
    );
  });

  it('famiglia K: senza varianti della stessa proporzione non c’è srcset', () => {
    const square = {
      publicPath: '/media/b.png',
      width: 500,
      height: 300,
      altText: null,
      variants: [{ publicPath: '/media/b-150x150.png', width: 150, height: 150 }],
    };
    expect(imageAttributes(square)).toEqual({
      src: '/media/b.png',
      sizes: '(max-width: 500px) 100vw, 500px',
      width: 500,
      height: 300,
    });
  });

  it('famiglia K: oltre 2048 px una variante non entra, salvo che sia quella mostrata', () => {
    const big = {
      publicPath: '/media/c.jpg',
      width: 4000,
      height: 2000,
      altText: null,
      variants: [
        { publicPath: '/media/c-1024x512.jpg', width: 1024, height: 512 },
        { publicPath: '/media/c-2560x1280.jpg', width: 2560, height: 1280 },
      ],
    };
    expect(imageAttributes(big).srcSet).toBe('/media/c-1024x512.jpg 1024w, /media/c.jpg 4000w');
  });

  it('D59: con la variante scelta, src, dimensioni e sizes sono quelli della variante', () => {
    expect(imageAttributes(media[MEDIA_ID]!, '768x384')).toEqual({
      src: '/media/2026/01/sintetica-768x384.png',
      srcSet:
        '/media/2026/01/sintetica-300x150.png 300w, /media/2026/01/sintetica-768x384.png 768w, /media/2026/01/sintetica.png 1200w',
      sizes: '(max-width: 768px) 100vw, 768px',
      width: 768,
      height: 384,
    });
  });

  it('D59: una variante che non esiste fa tornare all’originale', () => {
    expect(imageAttributes(media[MEDIA_ID]!, '999x999').src).toBe('/media/2026/01/sintetica.png');
  });

  it('con la mappa, l’immagine ha il suo indirizzo; il testo alternativo del blocco prevale', () => {
    const { container } = render(
      <BlocksDocument document={documentWithImage(MEDIA_ID, 'Dal blocco')} media={media} />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/media/2026/01/sintetica.png');
    expect(img?.getAttribute('alt')).toBe('Dal blocco');
    expect(img?.getAttribute('data-media-id')).toBeNull();
  });

  it('senza testo alternativo nel blocco, vale quello dell’archivio', () => {
    const { container } = render(
      <BlocksDocument document={documentWithImage(MEDIA_ID)} media={media} />,
    );
    expect(container.querySelector('img')?.getAttribute('alt')).toBe(
      'Testo alternativo dall’archivio',
    );
  });

  it('senza mappa, come nell’anteprima, resta il segnaposto', () => {
    const { container } = render(<BlocksDocument document={documentWithImage(MEDIA_ID)} />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBeNull();
    expect(img?.getAttribute('data-media-id')).toBe(MEDIA_ID);
  });

  it('un media assente dalla mappa, per esempio riservato, non ottiene un indirizzo', () => {
    const { container } = render(
      <BlocksDocument
        document={documentWithImage('33333333-3333-4333-8333-333333333333')}
        media={media}
      />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBeNull();
  });
});

/**
 * I2 (DR-183, DR-195): i filtri `et_filter_wp_calculate_image_srcset` e
 * `et_filter_wp_calculate_image_sizes` di Divi. Le derivate Divi si riconoscono
 * dalla larghezza (480, 980, 1280) e dalla proporzione dell'originale; quando ci
 * sono, il `srcset` contiene solo quelle non più larghe dell'immagine mostrata,
 * più la mostrata se supera la chiave più grande, in ordine decrescente come il
 * `krsort` di Divi, e `sizes` è a fasce. Una sola sorgente: niente `srcset`, e
 * WordPress allora non scrive nemmeno `sizes`.
 */
describe('derivate Divi (I2)', () => {
  it('caso A: una sola sorgente utile, niente srcset né sizes (misurato su /genitori-si-resta/)', () => {
    const poster = {
      publicPath: '/media/p.jpg',
      width: 1131,
      height: 1600,
      altText: null,
      variants: [
        { publicPath: '/media/p-212x300.jpg', width: 212, height: 300 },
        { publicPath: '/media/p-480x679.jpg', width: 480, height: 679 },
        { publicPath: '/media/p-724x1024.jpg', width: 724, height: 1024 },
        { publicPath: '/media/p-768x1086.jpg', width: 768, height: 1086 },
        { publicPath: '/media/p-980x1386.jpg', width: 980, height: 1386 },
      ],
    };
    expect(imageAttributes(poster, '724x1024')).toEqual({
      src: '/media/p-724x1024.jpg',
      width: 724,
      height: 1024,
    });
  });

  it('caso C: originale oltre 1280, quattro sorgenti e sizes a fasce Divi (misurato su /servizi/)', () => {
    const square = {
      publicPath: '/media/s.png',
      width: 3543,
      height: 3543,
      altText: null,
      variants: [300, 480, 768, 980, 1024, 1280, 1536, 2048].map((w) => ({
        publicPath: `/media/s-${w}x${w}.png`,
        width: w,
        height: w,
      })),
    };
    expect(imageAttributes(square)).toEqual({
      src: '/media/s.png',
      srcSet:
        '/media/s.png 3543w, /media/s-1280x1280.png 1280w, /media/s-980x980.png 980w, /media/s-480x480.png 480w',
      sizes:
        '(min-width: 0px) and (max-width: 480px) 480px, (min-width: 481px) and (max-width: 980px) 980px, (min-width: 981px) and (max-width: 1280px) 1280px, (min-width: 1281px) 3543px, 100vw',
      width: 3543,
      height: 3543,
    });
  });

  it('originale di 886 px con la sola derivata 480: due sorgenti e due fasce', () => {
    const narrow = {
      publicPath: '/media/n.jpg',
      width: 886,
      height: 1250,
      altText: null,
      variants: [
        { publicPath: '/media/n-150x150.jpg', width: 150, height: 150 },
        { publicPath: '/media/n-480x677.jpg', width: 480, height: 677 },
        { publicPath: '/media/n-768x1084.jpg', width: 768, height: 1084 },
      ],
    };
    expect(imageAttributes(narrow)).toEqual({
      src: '/media/n.jpg',
      srcSet: '/media/n.jpg 886w, /media/n-480x677.jpg 480w',
      sizes: '(min-width: 0px) and (max-width: 480px) 480px, (min-width: 481px) 886px, 100vw',
      width: 886,
      height: 1250,
    });
  });

  it('immagine mostrata più stretta di 480: nessuna derivata Divi utile, niente srcset', () => {
    const square = {
      publicPath: '/media/q.png',
      width: 2000,
      height: 2000,
      altText: null,
      variants: [300, 480, 980, 1280].map((w) => ({
        publicPath: `/media/q-${w}x${w}.png`,
        width: w,
        height: w,
      })),
    };
    expect(imageAttributes(square, '300x300')).toEqual({
      src: '/media/q-300x300.png',
      width: 300,
      height: 300,
    });
  });

  it('a 480 px con proporzione diversa non è una derivata Divi: resta la regola di WordPress', () => {
    const wide = {
      publicPath: '/media/w.jpg',
      width: 1200,
      height: 600,
      altText: null,
      variants: [
        { publicPath: '/media/w-480x480.jpg', width: 480, height: 480 },
        { publicPath: '/media/w-768x384.jpg', width: 768, height: 384 },
      ],
    };
    expect(imageAttributes(wide).srcSet).toBe('/media/w-768x384.jpg 768w, /media/w.jpg 1200w');
    expect(imageAttributes(wide).sizes).toBe('(max-width: 1200px) 100vw, 1200px');
  });
});

describe('caso B: a parità di larghezza (misurato su /le-dipendenze/)', () => {
  const sameWidth = {
    publicPath: '/media/d.jpg',
    width: 1024,
    height: 500,
    altText: null,
    variants: [
      { publicPath: '/media/d-300x146.jpg', width: 300, height: 146 },
      { publicPath: '/media/d-1024x500.jpg', width: 1024, height: 500 },
      { publicPath: '/media/d-768x375.jpg', width: 768, height: 375 },
    ],
  };

  it('vince l’originale sulla derivata della stessa larghezza', () => {
    expect(imageAttributes(sameWidth).srcSet).toBe(
      '/media/d-300x146.jpg 300w, /media/d-768x375.jpg 768w, /media/d.jpg 1024w',
    );
  });

  it('con la derivata mostrata, vince la mostrata', () => {
    expect(imageAttributes(sameWidth, '1024x500').srcSet).toBe(
      '/media/d-300x146.jpg 300w, /media/d-1024x500.jpg 1024w, /media/d-768x375.jpg 768w',
    );
  });
});
