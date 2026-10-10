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
