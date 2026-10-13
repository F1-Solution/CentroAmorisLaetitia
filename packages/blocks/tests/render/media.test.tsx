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
