/**
 * Il blocco di riserva `html` (`BLOCK-MODEL.md` §3.14). Si usa solo quando la
 * conversione perderebbe qualcosa di visibile; ogni uso è contato (via
 * `countReserveBlocks`, `@amoris/blocks`) e motivato con `reason` + `detail`.
 *
 * Anche qui si rimuove sempre ciò che è pericoloso (§3.14.2): la fedeltà si
 * conserva, il pericolo no.
 */
import { htmlPropsSchema, stripDangerousMarkup, type HtmlBlockReason, type HtmlProps } from './blocks.js';
import type { ConvertContext } from './context.js';

export interface HtmlFallbackInput {
  readonly html: string;
  readonly reason: HtmlBlockReason;
  /** Nome del modulo o dello shortcode non rappresentato, mai il suo contenuto (§3.14.1). */
  readonly detail: string | null;
  readonly start: number;
  readonly end: number;
}

export interface BuiltHtmlBlock {
  readonly type: 'html';
  readonly id: string;
  readonly props: HtmlProps;
  readonly children: never[];
}

/**
 * Costruisce un blocco `html` valido. Restituisce `null` se, dopo la rimozione
 * del pericoloso, non resta nulla: un blocco di riserva vuoto violerebbe
 * `htmlPropsSchema` (`html` non vuoto) e non rappresenterebbe comunque nulla.
 */
export function buildHtmlFallbackBlock(ctx: ConvertContext, input: HtmlFallbackInput): BuiltHtmlBlock | null {
  const stripped = stripDangerousMarkup(input.html);
  for (const issue of stripped.issues) {
    ctx.push({
      severity: issue.severity,
      code: 'sanitize-removed',
      detail: issue.attribute ? `${issue.element}.${issue.attribute}` : issue.element,
    });
  }

  const html = stripped.html;
  if (html.trim() === '') {
    return null;
  }

  const props = htmlPropsSchema.parse({
    html,
    reason: input.reason,
    detail: input.detail,
    classes: [],
  });

  return {
    type: 'html',
    id: ctx.allocateId('html', input.start, input.end),
    props,
    children: [],
  };
}
