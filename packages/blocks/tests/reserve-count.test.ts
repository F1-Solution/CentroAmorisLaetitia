import { describe, expect, it } from 'vitest';
import { countReserveBlocks } from '../src/reserve-count.js';
import type { BlockDocument } from '../src/schema/document.js';
import { testBlockId, makeRichText } from './helpers.js';

function htmlBlock(reason: 'wp_html_block' | 'divi_unmapped_module' | 'divi_unmapped_markup' | 'shortcode_unknown' | 'manual') {
  return {
    type: 'html' as const,
    id: testBlockId(),
    props: { html: '<div>x</div>', reason, detail: null, classes: [] },
    children: [],
  };
}

function docWith(blocks: unknown[]): BlockDocument {
  return { schema: 1, blocks: blocks as BlockDocument['blocks'] };
}

describe('countReserveBlocks (§8)', () => {
  it('conta zero su un insieme senza blocchi html', () => {
    const docs = [docWith([makeRichText('<p>x</p>')]), docWith([makeRichText('<p>y</p>')])];
    const result = countReserveBlocks(docs);
    expect(result.htmlBlocks).toBe(0);
    expect(result.touchedContents).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.exceedsPercentageThreshold).toBe(false);
    expect(result.exceedsContentThreshold).toBe(false);
  });

  it('sotto soglia: 1 html su 20 blocchi non contenitori (5%), 1 contenuto toccato', () => {
    const nonHtmlBlocks = Array.from({ length: 19 }, () => makeRichText('<p>x</p>'));
    const docs = [docWith([...nonHtmlBlocks, htmlBlock('manual')])];
    const result = countReserveBlocks(docs);
    expect(result.nonContainerBlocks).toBe(20);
    expect(result.htmlBlocks).toBe(1);
    expect(result.percentage).toBe(5);
    expect(result.touchedContents).toBe(1);
    expect(result.exceedsPercentageThreshold).toBe(false);
    expect(result.exceedsContentThreshold).toBe(false);
  });

  it('sopra soglia di percentuale: più del 10% non arrotondato', () => {
    // 9 blocchi normali + 2 html = 11 non contenitori, 2/11 = 18,18...%.
    const nonHtmlBlocks = Array.from({ length: 9 }, () => makeRichText('<p>x</p>'));
    const docs = [docWith([...nonHtmlBlocks, htmlBlock('manual'), htmlBlock('shortcode_unknown')])];
    const result = countReserveBlocks(docs);
    expect(result.exceedsPercentageThreshold).toBe(true);
  });

  it('un valore appena sopra il 10% non arrotondato supera comunque la soglia', () => {
    // 100 blocchi non contenitori, 11 html => 11% esatto, supera.
    const nonHtmlBlocks = Array.from({ length: 89 }, () => makeRichText('<p>x</p>'));
    const htmlBlocks = Array.from({ length: 11 }, () => htmlBlock('manual'));
    const docs = [docWith([...nonHtmlBlocks, ...htmlBlocks])];
    const result = countReserveBlocks(docs);
    expect(result.percentage).toBeCloseTo(11, 5);
    expect(result.exceedsPercentageThreshold).toBe(true);
  });

  it('sopra soglia sui contenuti toccati: 16 contenuti su 108 con un html ciascuno', () => {
    const docsWithHtml = Array.from({ length: 16 }, () => docWith([htmlBlock('wp_html_block')]));
    const docsWithoutHtml = Array.from({ length: 92 }, () => docWith([makeRichText('<p>x</p>')]));
    const result = countReserveBlocks([...docsWithHtml, ...docsWithoutHtml]);
    expect(result.touchedContents).toBe(16);
    expect(result.exceedsContentThreshold).toBe(true);
    expect(result.contentsCount).toBe(108);
  });

  it('15 contenuti toccati su 108 non supera la soglia (il limite è "più di 15")', () => {
    const docsWithHtml = Array.from({ length: 15 }, () => docWith([htmlBlock('wp_html_block')]));
    const docsWithoutHtml = Array.from({ length: 93 }, () => docWith([makeRichText('<p>x</p>')]));
    const result = countReserveBlocks([...docsWithHtml, ...docsWithoutHtml]);
    expect(result.touchedContents).toBe(15);
    expect(result.exceedsContentThreshold).toBe(false);
  });

  it('conta wp_html_block nel numeratore, senza esenzioni (§8.2)', () => {
    const docs = [docWith([htmlBlock('wp_html_block')])];
    const result = countReserveBlocks(docs);
    expect(result.htmlBlocks).toBe(1);
    expect(result.byReason.wp_html_block).toBe(1);
  });

  it('conta i blocchi html annidati dentro un media_text (§8.4)', () => {
    const mediaText = {
      type: 'media_text' as const,
      id: testBlockId(),
      props: {
        mediaId: null,
        mediaAlt: '',
        mediaVariant: null,
        mediaPosition: 'left' as const,
        mediaWidthPercent: null,
        verticalAlignment: 'center' as const,
        linkUrl: null,
        classes: [],
      },
      children: [htmlBlock('manual')],
    };
    const result = countReserveBlocks([docWith([mediaText])]);
    expect(result.htmlBlocks).toBe(1);
    // media_text è un contenitore (lettura letterale di ADR-005, §8.1): non entra nel denominatore.
    expect(result.nonContainerBlocks).toBe(1);
  });

  it('media_text non entra nel denominatore, letto come contenitore (§8.1)', () => {
    const mediaText = {
      type: 'media_text' as const,
      id: testBlockId(),
      props: {
        mediaId: null,
        mediaAlt: '',
        mediaVariant: null,
        mediaPosition: 'left' as const,
        mediaWidthPercent: null,
        verticalAlignment: 'center' as const,
        linkUrl: null,
        classes: [],
      },
      children: [makeRichText('<p>x</p>')],
    };
    const result = countReserveBlocks([docWith([mediaText])]);
    // Solo il rich_text figlio è non contenitore.
    expect(result.nonContainerBlocks).toBe(1);
  });
});
