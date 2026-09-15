/**
 * Il calcolo della soglia del blocco di riserva (`BLOCK-MODEL.md` §8,
 * ADR-005 §3.4), con numeri noti, sopra e sotto soglia. La funzione
 * (`countReserveBlocks`) vive in `@amoris/blocks`; qui si verifica che
 * l'integrazione con documenti prodotti dai convertitori la superi o meno
 * come previsto, usando documenti costruiti a mano con numeri di controllo.
 */
import { describe, expect, it } from 'vitest';
import { countReserveBlocks, type BlockDocument } from '../../../src/convert/shared/blocks.js';

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `b_${idCounter.toString(16).padStart(12, '0')}`;
}

function richText(id: string): BlockDocument['blocks'][number] {
  return {
    type: 'rich_text',
    id,
    props: { html: '<p>x</p>', textAlign: null, backgroundLayout: null, border: null, padding: emptySpacing(), classes: [] },
    children: [],
  };
}

function htmlBlock(id: string): BlockDocument['blocks'][number] {
  return {
    type: 'html',
    id,
    props: { html: '<div>x</div>', reason: 'wp_html_block', detail: null, classes: [] },
    children: [],
  };
}

function emptySpacing() {
  return { base: null, tablet: null, phone: null };
}

function docWithBlocks(count: number, htmlCount: number, _seed: string): BlockDocument {
  void _seed;
  const blocks: BlockDocument['blocks'] = [];
  for (let i = 0; i < count - htmlCount; i += 1) {
    blocks.push(richText(nextId()));
  }
  for (let i = 0; i < htmlCount; i += 1) {
    blocks.push(htmlBlock(nextId()));
  }
  return { schema: 1, blocks };
}

describe('countReserveBlocks — soglia (ADR-005 §3.4, BLOCK-MODEL.md §8)', () => {
  it('sotto soglia: 1 html su 100 blocchi non contenitori, 1 contenuto su 108', () => {
    const doc = docWithBlocks(100, 1, 'a');
    const documents: BlockDocument[] = [doc, ...Array.from({ length: 107 }, () => ({ schema: 1 as const, blocks: [] }))];
    const result = countReserveBlocks(documents);
    expect(result.nonContainerBlocks).toBe(100);
    expect(result.htmlBlocks).toBe(1);
    expect(result.percentage).toBe(1);
    expect(result.touchedContents).toBe(1);
    expect(result.exceedsPercentageThreshold).toBe(false);
    expect(result.exceedsContentThreshold).toBe(false);
  });

  it('sopra soglia di percentuale: 11 html su 100 blocchi non contenitori', () => {
    const doc = docWithBlocks(100, 11, 'b');
    const result = countReserveBlocks([doc]);
    expect(result.percentage).toBe(11);
    expect(result.exceedsPercentageThreshold).toBe(true);
  });

  it('esattamente 10% non supera la soglia (il confronto è > 10, non >=)', () => {
    const doc = docWithBlocks(100, 10, 'c');
    const result = countReserveBlocks([doc]);
    expect(result.percentage).toBe(10);
    expect(result.exceedsPercentageThreshold).toBe(false);
  });

  it('sopra soglia di contenuti: 16 contenuti su 108 con almeno un html', () => {
    const documents: BlockDocument[] = [
      ...Array.from({ length: 16 }, (_, i) => docWithBlocks(10, 1, `d${i}`)),
      ...Array.from({ length: 92 }, () => ({ schema: 1 as const, blocks: [] })),
    ];
    const result = countReserveBlocks(documents);
    expect(result.touchedContents).toBe(16);
    expect(result.exceedsContentThreshold).toBe(true);
  });

  it('esattamente 15 contenuti su 108 non supera la soglia', () => {
    const documents: BlockDocument[] = [
      ...Array.from({ length: 15 }, (_, i) => docWithBlocks(10, 1, `e${i}`)),
      ...Array.from({ length: 93 }, () => ({ schema: 1 as const, blocks: [] })),
    ];
    const result = countReserveBlocks(documents);
    expect(result.touchedContents).toBe(15);
    expect(result.exceedsContentThreshold).toBe(false);
  });
});
