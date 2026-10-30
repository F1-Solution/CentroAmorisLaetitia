import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Image } from '../../src/render/Image.js';
import type { MediaMap } from '../../src/render/media.js';
import { imagePropsSchema } from '../../src/schema/image.js';
import type { ImageBlock } from '../../src/schema/block.js';
import { testBlockId } from '../helpers.js';

/**
 * Wave 1G-W9, T1 (W8-10, W8-12, DR-305): testo alternativo e didascalia lasciati vuoti nel blocco
 * si leggono dal media al momento della resa; il blocco compilato vince; «decorativa» è una
 * proprietà a parte e dà sempre `alt=""`; il titolo del blocco diventa l'attributo `title`.
 */

const MEDIA_ID = '22222222-2222-4222-8222-222222222222';
const media: MediaMap = {
  [MEDIA_ID]: {
    publicPath: '/media/2026/01/sintetica.png',
    width: 1200,
    height: 600,
    altText: 'Alt dall’archivio',
    title: 'Titolo dall’archivio',
    caption: 'Didascalia dall’archivio',
    variants: [],
  },
};

function block(props: Record<string, unknown> = {}): ImageBlock {
  return {
    type: 'image',
    id: testBlockId(),
    props: imagePropsSchema.parse({ mediaId: MEDIA_ID, ...props }),
    children: [],
  };
}

function html(b: ImageBlock, map: MediaMap | undefined = media) {
  const { container } = render(<Image block={b} media={map} />);
  return container;
}

describe('immagine: testi del media letti alla resa (DR-305)', () => {
  it('blocco senza alt né didascalia: il sito usa quelli del media', () => {
    const c = html(block());
    expect(c.querySelector('img')?.getAttribute('alt')).toBe('Alt dall’archivio');
    expect(c.querySelector('figcaption')?.textContent).toBe('Didascalia dall’archivio');
  });

  it('un testo cambiato nel media dopo la scrittura del blocco arriva alla pagina', () => {
    const changed: MediaMap = {
      [MEDIA_ID]: { ...media[MEDIA_ID]!, altText: 'Nuovo alt', caption: 'Nuova didascalia' },
    };
    const c = html(block(), changed);
    expect(c.querySelector('img')?.getAttribute('alt')).toBe('Nuovo alt');
    expect(c.querySelector('figcaption')?.textContent).toBe('Nuova didascalia');
  });

  it('alt e didascalia compilati nel blocco vincono su quelli del media', () => {
    const c = html(block({ alt: 'Alt del blocco', caption: 'Didascalia del blocco' }));
    expect(c.querySelector('img')?.getAttribute('alt')).toBe('Alt del blocco');
    expect(c.querySelector('figcaption')?.textContent).toBe('Didascalia del blocco');
  });

  it('un’immagine decorativa ha sempre alt vuoto, anche se il media ha un testo', () => {
    const c = html(block({ decorative: true }));
    expect(c.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('un’immagine decorativa ignora anche un alt rimasto nel blocco', () => {
    const c = html(block({ decorative: true, alt: 'Vecchio alt' }));
    expect(c.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('senza didascalia né nel blocco né nel media non c’è figcaption', () => {
    const bare: MediaMap = { [MEDIA_ID]: { ...media[MEDIA_ID]!, caption: null } };
    expect(html(block(), bare).querySelector('figcaption')).toBeNull();
  });

  it('un blocco di prima (senza il campo decorative) si valida e resta non decorativo', () => {
    const parsed = imagePropsSchema.parse({ mediaId: MEDIA_ID, alt: 'x' });
    expect(parsed.decorative ?? false).toBe(false);
  });
});

describe('immagine: attributo title (W8-12)', () => {
  it('il titolo del blocco compare come attributo title', () => {
    const c = html(block({ title: 'Titolo del blocco' }));
    expect(c.querySelector('img')?.getAttribute('title')).toBe('Titolo del blocco');
  });

  it('senza titolo nel blocco non c’è title: il titolo del media non si propaga alle pagine importate', () => {
    expect(html(block()).querySelector('img')?.hasAttribute('title')).toBe(false);
  });
});

describe('immagine: pagine importate (parità)', () => {
  it('un blocco importato con alt e senza didascalia né titolo, su un media senza didascalia, rende come prima', () => {
    const plain: MediaMap = {
      [MEDIA_ID]: { ...media[MEDIA_ID]!, caption: null, title: null },
    };
    const c = html(block({ alt: 'Alt importato' }), plain);
    expect(c.querySelector('figure')?.innerHTML).toBe(
      `<img alt="Alt importato" sizes="(max-width: 1200px) 100vw, 1200px" width="1200" height="600" src="/media/2026/01/sintetica.png">`,
    );
  });
});

/**
 * DR-312 (D203 B): i blocchi importati portano `useMediaCaption: false` e non mostrano la
 * didascalia del media, come il modulo Divi della sorgente; quelli creati nell'area non hanno il
 * campo e seguono DR-305. DR-313 (D204 A): il titolo del media non fa mai da riserva.
 */
describe('immagine: blocchi importati e didascalia del media (DR-312)', () => {
  it('un blocco importato senza didascalia non mostra quella del media', () => {
    const c = html(block({ alt: 'Alt importato', useMediaCaption: false }));
    expect(c.querySelector('figcaption')).toBeNull();
    // Il testo alternativo del media resta come riserva anche per gli importati.
    expect(
      html(block({ useMediaCaption: false }))
        .querySelector('img')
        ?.getAttribute('alt'),
    ).toBe('Alt dall’archivio');
  });

  it('un blocco importato con una didascalia sua la mostra', () => {
    const c = html(block({ caption: 'Didascalia scritta', useMediaCaption: false }));
    expect(c.querySelector('figcaption')?.textContent).toBe('Didascalia scritta');
  });

  it('un blocco importato rende come prima della DR-305 anche se il media ha una didascalia', () => {
    const c = html(block({ alt: 'Alt importato', useMediaCaption: false }));
    expect(c.querySelector('figure')?.innerHTML).toBe(
      `<img alt="Alt importato" sizes="(max-width: 1200px) 100vw, 1200px" width="1200" height="600" src="/media/2026/01/sintetica.png">`,
    );
  });

  it('un blocco creato nell’area (senza il campo) continua a usare la didascalia del media', () => {
    const parsed = imagePropsSchema.parse({ mediaId: MEDIA_ID });
    expect(parsed.useMediaCaption).toBeUndefined();
    expect(html(block()).querySelector('figcaption')?.textContent).toBe('Didascalia dall’archivio');
  });

  it('lo schema accetta il campo e rifiuta un valore che non è vero o falso', () => {
    expect(imagePropsSchema.safeParse({ mediaId: MEDIA_ID, useMediaCaption: false }).success).toBe(
      true,
    );
    expect(imagePropsSchema.safeParse({ mediaId: MEDIA_ID, useMediaCaption: 'no' }).success).toBe(
      false,
    );
  });

  it('DR-313: il titolo del media non fa da riserva, né per i blocchi nuovi né per gli importati', () => {
    expect(html(block()).querySelector('img')?.hasAttribute('title')).toBe(false);
    expect(
      html(block({ useMediaCaption: false }))
        .querySelector('img')
        ?.hasAttribute('title'),
    ).toBe(false);
  });
});
