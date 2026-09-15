/**
 * Punto di ingresso del modulo `convert` (`IMPORTER-DESIGN.md` §2): da
 * sorgente a documento a blocchi valido secondo `@amoris/blocks`. Non tocca il
 * database, non riscrive i riferimenti ai media (fase 15, ADR-004 §3.3).
 */
import { blockDocumentSchema, type BlockDocument, type BlockNode } from './shared/blocks.js';
import { createConvertContext, type ConvertResolvers } from './shared/context.js';
import type { ConvertIssue } from './shared/issue.js';
import { detectContentFamily, type ContentFamily } from './family.js';
import { convertGutenbergContent } from './gutenberg/convert.js';
import { convertDiviContent } from './divi/convert.js';
import { convertRawHtmlContent } from './html/convert.js';

export interface ConvertContentInput {
  readonly legacyContentId: string | number;
  readonly postContent: string;
  readonly resolvers?: ConvertResolvers;
}

export interface ConvertContentResult {
  readonly family: ContentFamily;
  readonly document: BlockDocument;
  readonly issues: readonly ConvertIssue[];
}

/**
 * Converte un contenuto per intero. La famiglia si sceglie **per contenuto**
 * (ADR-005 §1 punto 1, `divi-shortcode-strategy.md` §1): nessun contenuto
 * misto è previsto, quindi non serve riconoscere confini interni.
 */
export function convertContent(input: ConvertContentInput): ConvertContentResult {
  const family = detectContentFamily(input.postContent);
  const ctx = createConvertContext(input.legacyContentId, input.postContent, input.resolvers ?? {});

  let blocks: BlockNode[];
  switch (family) {
    case 'gutenberg':
      blocks = convertGutenbergContent(input.postContent, ctx);
      break;
    case 'divi':
      blocks = convertDiviContent(input.postContent, ctx);
      break;
    case 'html':
      blocks = convertRawHtmlContent(input.postContent, ctx);
      break;
  }

  const document = blockDocumentSchema.parse({ schema: 1, blocks });

  return { family, document, issues: ctx.issues };
}

export * from './family.js';
export * from './shared/context.js';
export * from './shared/issue.js';
export * from './shared/url-normalize.js';
export { convertGutenbergContent } from './gutenberg/convert.js';
export { convertDiviContent } from './divi/convert.js';
export { convertRawHtmlContent } from './html/convert.js';
