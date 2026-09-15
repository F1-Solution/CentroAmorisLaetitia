/** Aiuti condivisi dai test: non è un file di test (non finisce in `*.test.ts`). */
import type { BlockNode } from '../src/schema/block.js';

let counter = 0;

/** Identificatore sintetico valido per la forma `b_[0-9a-f]{12}` (§4). */
export function testBlockId(): string {
  counter += 1;
  return `b_${counter.toString(16).padStart(12, '0')}`;
}

export function makeRichText(html: string, overrides: Record<string, unknown> = {}): Extract<BlockNode, { type: 'rich_text' }> {
  return {
    type: 'rich_text',
    id: testBlockId(),
    props: {
      html,
      textAlign: null,
      backgroundLayout: null,
      border: null,
      padding: { base: null, tablet: null, phone: null },
      classes: [],
      ...overrides,
    },
    children: [],
  } as Extract<BlockNode, { type: 'rich_text' }>;
}
