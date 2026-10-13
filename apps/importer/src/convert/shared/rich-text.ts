/**
 * Costruisce un blocco `rich_text` sanificato, o — se il frammento contiene un
 * elemento non ammesso ma innocuo — un blocco di riserva `html` con
 * `reason: 'divi_unmapped_markup'` (`BLOCK-MODEL.md` §5.4, ultima riga).
 *
 * Prima della sanificazione si normalizzano gli URL relativi allo schema del
 * sito stesso (`shared/url-normalize.ts`): il sanificatore li rifiuta, e senza
 * questo passaggio si perderebbero immagini e collegamenti.
 */
import {
  richTextPropsSchema,
  sanitizeRichText,
  type Spacing,
  type RichTextProps,
} from './blocks.js';
import type { ConvertContext } from './context.js';
import { buildHtmlFallbackBlock, type BuiltHtmlBlock } from './html-fallback.js';
import { normalizeSameSiteUrls } from './url-normalize.js';
import { richTextClasses } from './classes.js';
import { wpautop } from './wpautop.js';

export interface RichTextExtras {
  readonly textAlign?: RichTextProps['textAlign'];
  readonly backgroundLayout?: RichTextProps['backgroundLayout'];
  readonly border?: RichTextProps['border'];
  readonly padding?: Spacing;
}

export interface BuiltRichTextBlock {
  readonly type: 'rich_text';
  readonly id: string;
  readonly props: RichTextProps;
  readonly children: never[];
}

export type RichTextOrFallback = BuiltRichTextBlock | BuiltHtmlBlock;

/**
 * `null` quando il frammento, dopo la normalizzazione e la sanificazione, non
 * contiene più nulla di renderizzabile (per esempio un commento isolato):
 * niente da rappresentare, quindi nessun blocco.
 */
export function buildRichTextOrFallback(
  ctx: ConvertContext,
  rawHtml: string,
  range: { start: number; end: number },
  extras: RichTextExtras = {},
  { autop = true }: { readonly autop?: boolean } = {},
): RichTextOrFallback | null {
  // `wpautop()` come nella resa della sorgente, una sola volta; WordPress non lo applica ai contenuti con blocchi.
  const { html: normalizedHtml, count: normalizedCount } = normalizeSameSiteUrls(
    autop ? wpautop(rawHtml) : rawHtml,
  );
  if (normalizedCount > 0) {
    ctx.push({
      severity: 'info',
      code: 'same-site-url-normalized',
      detail: `${normalizedCount}`,
    });
  }

  const outcome = sanitizeRichText(normalizedHtml);

  for (const issue of outcome.issues) {
    if (issue.attribute === 'style') {
      ctx.push({
        severity: issue.severity,
        code: 'sanitize-removed',
        detail: `${issue.element}.style`,
      });
      continue;
    }
    ctx.push({
      severity: issue.severity,
      code: 'sanitize-removed',
      detail: issue.attribute ? `${issue.element}.${issue.attribute}` : issue.element,
    });
  }

  if (!outcome.ok) {
    ctx.push({ severity: 'warning', code: 'unmapped-markup', detail: outcome.element });
    return buildHtmlFallbackBlock(ctx, {
      html: normalizedHtml,
      reason: 'divi_unmapped_markup',
      detail: outcome.element,
      start: range.start,
      end: range.end,
    });
  }

  if (outcome.html.trim() === '') {
    return null;
  }

  const textAlign = extras.textAlign ?? null;
  const backgroundLayout = extras.backgroundLayout ?? null;
  const classes = richTextClasses({ textAlign, backgroundLayout });

  const props = richTextPropsSchema.parse({
    html: outcome.html,
    textAlign,
    backgroundLayout,
    border: extras.border ?? null,
    padding: extras.padding,
    classes,
  });

  return {
    type: 'rich_text',
    id: ctx.allocateId('rich_text', range.start, range.end),
    props,
    children: [],
  };
}
