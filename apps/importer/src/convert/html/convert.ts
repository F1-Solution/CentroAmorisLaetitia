/**
 * Un contenuto HTML nudo (4 casi, ADR-005 §1) diventa un singolo `rich_text`
 * (ADR-005 §3.3 regola 3, `BLOCK-MODEL.md` §3.4 origine).
 */
import type { BlockNode } from '../shared/blocks.js';
import type { ConvertContext } from '../shared/context.js';
import { buildRichTextOrFallback } from '../shared/rich-text.js';

export function convertRawHtmlContent(text: string, ctx: ConvertContext): BlockNode[] {
  if (text.trim() === '') {
    return [];
  }
  const built = buildRichTextOrFallback(ctx, text, { start: 0, end: text.length });
  return built ? [built as BlockNode] : [];
}
