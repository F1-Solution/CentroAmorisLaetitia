import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Section } from '../../src/render/Section.js';
import { Row } from '../../src/render/Row.js';
import { Column } from '../../src/render/Column.js';
import { RichText } from '../../src/render/RichText.js';
import { Image } from '../../src/render/Image.js';
import { MediaText } from '../../src/render/MediaText.js';
import { Video } from '../../src/render/Video.js';
import { Map } from '../../src/render/Map.js';
import { Separator } from '../../src/render/Separator.js';
import { Form } from '../../src/render/Form.js';
import { PostList } from '../../src/render/PostList.js';
import { DocBlock } from '../../src/render/DocBlock.js';
import { Slider } from '../../src/render/Slider.js';
import { ReserveHtmlBlock } from '../../src/render/HtmlBlock.js';
import { BlocksDocument } from '../../src/render/BlocksDocument.js';
import { testBlockId, makeRichText } from '../helpers.js';
import type { BlockDocument } from '../../src/schema/document.js';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('componenti di resa — un test per tipo (ADR-006 §3.3)', () => {
  it('Section rende un <section> con id e figli', () => {
    const id = testBlockId();
    const { container } = render(
      <Section
        block={{
          type: 'section',
          id,
          props: {
            fullWidth: false,
            transparentBackground: false,
            backgroundColor: null,
            backgroundMediaId: null,
            parallax: false,
            innerShadow: false,
            customWidth: { mode: 'default', value: null },
            padding: { base: null, tablet: null, phone: null },
            classes: [],
          },
          children: [],
        }}
      />,
    );
    const el = container.querySelector('section');
    expect(el).not.toBeNull();
    expect(el?.id).toBe(id);
  });

  it('Row rende un <div class="blk blk-row">', () => {
    const { container } = render(
      <Row
        block={{
          type: 'row',
          id: testBlockId(),
          props: {
            columnStructure: '1_1',
            fullWidth: false,
            customWidth: { mode: 'default', value: null },
            gutter: { custom: false, width: null },
            backgroundColor: null,
            backgroundMediaId: null,
            padding: { base: null, tablet: null, phone: null },
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('.blk-row')).not.toBeNull();
  });

  it('Column rende un <div class="blk blk-column">', () => {
    const { container } = render(
      <Column
        block={{
          type: 'column',
          id: testBlockId(),
          props: { width: '1_1', padding: { base: null, tablet: null, phone: null }, classes: [] },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('.blk-column')).not.toBeNull();
  });

  it('Row di origine Gutenberg porta data-layout="flex"', () => {
    const { container } = render(
      <Row
        block={{
          type: 'row',
          id: testBlockId(),
          props: {
            columnStructure: '2_3,1_3',
            layout: 'flex',
            fullWidth: false,
            customWidth: { mode: 'default', value: null },
            gutter: { custom: false, width: null },
            backgroundColor: null,
            backgroundMediaId: null,
            padding: { base: null, tablet: null, phone: null },
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('.blk-row')?.getAttribute('data-layout')).toBe('flex');
  });

  it('Column espone la larghezza come attributo, senza stile in linea in più', () => {
    const { container } = render(
      <Column
        block={{
          type: 'column',
          id: testBlockId(),
          props: { width: '2_3', padding: { base: null, tablet: null, phone: null }, classes: [] },
          children: [],
        }}
      />,
    );
    const el = container.querySelector<HTMLElement>('.blk-column');
    expect(el?.getAttribute('data-width')).toBe('2_3');
    expect(el?.getAttribute('style')).toBeNull();
  });

  it('RichText inietta props.html', () => {
    const node = makeRichText('<p>Contenuto <strong>ricco</strong></p>');
    const { container } = render(<RichText block={node} />);
    expect(container.querySelector('strong')?.textContent).toBe('ricco');
  });

  it('Image rende <img alt="...">', () => {
    const { container } = render(
      <Image
        block={{
          type: 'image',
          id: testBlockId(),
          props: {
            mediaId: uuid,
            src: null,
            variant: null,
            alt: 'descrizione',
            title: null,
            caption: null,
            linkUrl: null,
            linkNewWindow: false,
            align: null,
            alignTablet: null,
            forceFullWidth: false,
            lightbox: false,
            centerOnMobile: false,
            animation: null,
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('descrizione');
  });

  it("MediaText rende l'immagine solo se c'è mediaId", () => {
    const { container } = render(
      <MediaText
        block={{
          type: 'media_text',
          id: testBlockId(),
          props: {
            mediaId: uuid,
            mediaAlt: 'alt',
            mediaVariant: null,
            mediaPosition: 'left',
            mediaWidthPercent: null,
            verticalAlignment: 'center',
            linkUrl: null,
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('MediaText separa immagine e contenuto e dichiara posizione e allineamento (V)', () => {
    const { container } = render(
      <MediaText
        block={{
          type: 'media_text',
          id: testBlockId(),
          props: {
            mediaId: uuid,
            mediaAlt: 'alt',
            mediaVariant: null,
            mediaPosition: 'right',
            mediaWidthPercent: null,
            verticalAlignment: 'top',
            linkUrl: null,
            classes: [],
          },
          children: [],
        }}
      />,
    );
    const root = container.firstElementChild;
    expect(root?.getAttribute('data-media-position')).toBe('right');
    expect(root?.getAttribute('data-align')).toBe('top');
    expect(root?.querySelector(':scope > figure.blk-media-text-media > img')).not.toBeNull();
    expect(root?.querySelector(':scope > div.blk-media-text-content')).not.toBeNull();
  });

  it('Video rende un contenitore con i dati in data-*', () => {
    const { container } = render(
      <Video
        block={{
          type: 'video',
          id: testBlockId(),
          props: {
            src: 'https://youtu.be/abc',
            provider: 'youtube',
            posterMediaId: null,
            posterSrc: null,
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('.blk-video')?.getAttribute('data-provider')).toBe('youtube');
  });

  it("Map rende l'indirizzo come testo", () => {
    const { getByText } = render(
      <Map
        block={{
          type: 'map',
          id: testBlockId(),
          props: {
            address: 'Via Roma 1',
            lat: '45.0',
            lng: '9.0',
            zoom: null,
            mouseWheel: false,
            mobileDragging: false,
            grayscale: false,
            grayscaleAmount: null,
            pins: [],
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(getByText('Via Roma 1')).not.toBeNull();
  });

  it('Separator rende un <hr>', () => {
    const { container } = render(
      <Separator
        block={{
          type: 'separator',
          id: testBlockId(),
          props: { style: 'default', classes: [] },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('Form rende un contenitore con i dati del riferimento', () => {
    const { container } = render(
      <Form
        block={{
          type: 'form',
          id: testBlockId(),
          props: {
            formId: uuid,
            origin: 'wpforms',
            showTitle: false,
            showDescription: false,
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('.blk-form')?.getAttribute('data-form-id')).toBe(uuid);
  });

  it('PostList rende un contenitore vuoto', () => {
    const { container } = render(
      <PostList
        block={{
          type: 'post_list',
          id: testBlockId(),
          props: {
            termIds: [],
            limit: null,
            offset: 0,
            showThumbnail: true,
            showDate: true,
            showExcerpt: true,
            order: 'date_desc',
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('.blk-post-list')).not.toBeNull();
  });

  it('DocBlock rende la label quando presente', () => {
    const { getByText } = render(
      <DocBlock
        block={{
          type: 'document',
          id: testBlockId(),
          props: { documentId: uuid, label: 'Scarica il modulo', display: 'link', classes: [] },
          children: [],
        }}
      />,
    );
    expect(getByText('Scarica il modulo')).not.toBeNull();
  });

  it('Slider rende un contenitore con il riferimento', () => {
    const { container } = render(
      <Slider
        block={{
          type: 'slider',
          id: testBlockId(),
          props: { sliderId: uuid, classes: [] },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('.blk-slider')?.getAttribute('data-slider-id')).toBe(uuid);
  });

  it("ReserveHtmlBlock inietta il markup di riserva così com'è", () => {
    const { container } = render(
      <ReserveHtmlBlock
        block={{
          type: 'html',
          id: testBlockId(),
          props: {
            html: '<center>vecchio</center>',
            reason: 'divi_unmapped_markup',
            detail: null,
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('center')?.textContent).toBe('vecchio');
  });
});

describe("BlocksDocument — resa dell'intero documento", () => {
  it("rende tutti i blocchi di primo livello nell'ordine dato", () => {
    const doc: BlockDocument = {
      schema: 1,
      blocks: [makeRichText('<p>Uno</p>'), makeRichText('<p>Due</p>')],
    };
    const { container } = render(<BlocksDocument document={doc} />);
    const texts = Array.from(container.querySelectorAll('.blk-text')).map((el) => el.textContent);
    expect(texts).toEqual(['Uno', 'Due']);
  });
});
