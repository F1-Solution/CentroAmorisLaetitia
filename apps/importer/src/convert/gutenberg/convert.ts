/**
 * Da blocchi Gutenberg a blocchi del modello (`divi-shortcode-strategy.md` §4,
 * `BLOCK-MODEL.md` §3). I paragrafi contigui si fondono (§4.1);
 * `wp:divi/placeholder` è un marcatore e si scarta.
 */
import {
  defaultCustomWidth,
  defaultGutter,
  emptySpacing,
  formPropsSchema,
  htmlPropsSchema,
  imagePropsSchema,
  mediaTextPropsSchema,
  rowPropsSchema,
  separatorPropsSchema,
  type BlockNode,
  type ColumnBlock,
} from '../shared/blocks.js';
import type { ConvertContext } from '../shared/context.js';
import { buildHtmlFallbackBlock } from '../shared/html-fallback.js';
import { buildRichTextOrFallback } from '../shared/rich-text.js';
import { deriveGutenbergColumnWidth } from '../shared/column-width.js';
import { findFirstTag, findTagContent } from '../shared/html-attrs.js';
import { normalizeSameSiteUrlValue } from '../shared/url-normalize.js';
import { convertNonDiviShortcode } from '../shared/non-divi-shortcodes.js';
import type { ParsedShortcode } from '../divi/shortcodes.js';
import { parseGutenbergBlocks, type ParsedGutenbergBlock } from './comments.js';

/** Punto di ingresso: converte l'intero `post_content` di un contenuto Gutenberg. */
export function convertGutenbergContent(text: string, ctx: ConvertContext): BlockNode[] {
  return convertSiblings(parseGutenbergBlocks(text), ctx);
}

function convertSiblings(blocks: readonly ParsedGutenbergBlock[], ctx: ConvertContext): BlockNode[] {
  const out: BlockNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i]!;

    // Fusione dei paragrafi contigui (`divi-shortcode-strategy.md` §4.1).
    if (block.blockName === 'paragraph') {
      let j = i;
      const run: ParsedGutenbergBlock[] = [];
      while (j < blocks.length && blocks[j]!.blockName === 'paragraph') {
        run.push(blocks[j]!);
        j += 1;
      }
      const html = run.map((b) => b.innerHtml).join('');
      const start = run[0]!.start;
      const end = run[run.length - 1]!.end;
      const built = buildRichTextOrFallback(ctx, html, { start, end });
      if (built) out.push(built as BlockNode);
      i = j;
      continue;
    }

    const built = convertSingleBlock(block, ctx);
    if (built) out.push(...(Array.isArray(built) ? built : [built]));
    i += 1;
  }
  return out;
}

function convertSingleBlock(block: ParsedGutenbergBlock, ctx: ConvertContext): BlockNode | BlockNode[] | null {
  switch (block.blockName) {
    case 'list':
    case 'heading':
      return buildRichTextOrFallback(ctx, block.innerHtml, { start: block.start, end: block.end }) as BlockNode | null;
    case 'image':
      return convertImage(block, ctx);
    case 'columns':
      return convertColumns(block, ctx);
    case 'column':
      // Non dovrebbe comparire fuori da `columns`, ma si converte comunque
      // per fedeltà: nessun contenuto è perso per un annidamento inatteso.
      return convertColumn(block, ctx, block.attrs.width, 1);
    case 'media-text':
      return convertMediaText(block, ctx);
    case 'separator':
      return convertSeparator(block, ctx);
    case 'wpforms/form-selector':
      return convertFormSelector(block, ctx);
    case 'html':
      return buildHtmlFallbackBlock(ctx, {
        html: block.innerHtml,
        reason: 'wp_html_block',
        detail: null,
        start: block.start,
        end: block.end,
      }) as BlockNode | null;
    case 'shortcode':
      return convertShortcodeBlock(block, ctx);
    case 'divi/placeholder':
      // Marcatore, non contenuto: si scarta (§4).
      return null;
    default: {
      ctx.push({ severity: 'warning', code: 'unmapped-markup', detail: `wp:${block.blockName}` });
      return buildHtmlFallbackBlock(ctx, {
        html: block.innerHtml || '',
        reason: 'divi_unmapped_module',
        detail: `wp:${block.blockName}`,
        start: block.start,
        end: block.end,
      }) as BlockNode | null;
    }
  }
}

function convertImage(block: ParsedGutenbergBlock, ctx: ConvertContext): BlockNode | null {
  const img = findFirstTag(block.innerHtml, 'img');
  const rawSrc = img?.attrs.src;
  const { value: src, normalized } = rawSrc ? normalizeSameSiteUrlValue(rawSrc) : { value: undefined, normalized: false };
  if (normalized) {
    ctx.push({ severity: 'info', code: 'same-site-url-normalized', detail: 'wp:image.src' });
  }
  if (!src) {
    ctx.push({ severity: 'warning', code: 'unresolved-media-reference', detail: 'wp:image.src' });
    return null;
  }

  const mediaId = ctx.resolvers.resolveMedia ? ctx.resolvers.resolveMedia(src) : null;
  const anchor = findFirstTag(block.innerHtml, 'a');
  const caption = findTagContent(block.innerHtml, 'figcaption');

  const align =
    block.attrs.align === 'left' || block.attrs.align === 'center' || block.attrs.align === 'right'
      ? block.attrs.align
      : null;

  const props = imagePropsSchema.parse({
    mediaId,
    src: mediaId ? null : src,
    variant: null,
    alt: img?.attrs.alt ?? '',
    title: img?.attrs.title ?? null,
    caption,
    linkUrl: anchor?.attrs.href ?? null,
    linkNewWindow: anchor?.attrs.target === '_blank',
    align,
    alignTablet: null,
    forceFullWidth: false,
    lightbox: false,
    centerOnMobile: false,
    animation: null,
    classes: [],
  });

  return {
    type: 'image',
    id: ctx.allocateId('image', block.start, block.end),
    props,
    children: [],
  };
}

function convertColumns(block: ParsedGutenbergBlock, ctx: ConvertContext): BlockNode {
  const columnChildren = block.innerBlocks.filter((child) => child.blockName === 'column');
  const columns = columnChildren.map((child) =>
    convertColumn(child, ctx, child.attrs.width, columnChildren.length),
  );

  const columnStructure = columns.map((c) => c.props.width).join(',');

  const props = rowPropsSchema.parse({
    columnStructure,
    fullWidth: false,
    customWidth: defaultCustomWidth,
    gutter: defaultGutter,
    backgroundColor: null,
    backgroundMediaId: null,
    padding: emptySpacing,
    classes: [],
  });

  return {
    type: 'row',
    id: ctx.allocateId('row', block.start, block.end),
    props,
    children: columns,
  };
}

function convertColumn(
  block: ParsedGutenbergBlock,
  ctx: ConvertContext,
  widthAttr: unknown,
  siblingCount: number,
): ColumnBlock {
  const width = deriveGutenbergColumnWidth(widthAttr, siblingCount);
  const children = convertSiblings(block.innerBlocks, ctx);

  return {
    type: 'column',
    id: ctx.allocateId('column', block.start, block.end),
    props: { width, padding: emptySpacing, classes: [] },
    children,
  };
}

function convertMediaText(block: ParsedGutenbergBlock, ctx: ConvertContext): BlockNode {
  const img = findFirstTag(block.innerHtml, 'img');
  const rawSrc = img?.attrs.src;
  const { value: src } = rawSrc ? normalizeSameSiteUrlValue(rawSrc) : { value: undefined };
  const mediaId = src && ctx.resolvers.resolveMedia ? ctx.resolvers.resolveMedia(src) : null;

  if (src && !mediaId) {
    ctx.push({ severity: 'warning', code: 'unresolved-media-reference', detail: 'wp:media-text' });
  }

  const mediaPosition = block.attrs.mediaPosition === 'right' ? 'right' : 'left';
  const verticalAlignmentRaw = block.attrs.verticalAlignment;
  const verticalAlignment =
    verticalAlignmentRaw === 'top' || verticalAlignmentRaw === 'bottom' ? verticalAlignmentRaw : 'center';
  const mediaWidthRaw = block.attrs.mediaWidth;
  const mediaWidthPercent =
    typeof mediaWidthRaw === 'number' && Number.isInteger(mediaWidthRaw) && mediaWidthRaw >= 1 && mediaWidthRaw <= 99
      ? mediaWidthRaw
      : null;

  const props = mediaTextPropsSchema.parse({
    mediaId,
    mediaAlt: img?.attrs.alt ?? '',
    mediaVariant: null,
    mediaPosition,
    mediaWidthPercent,
    verticalAlignment,
    linkUrl: null,
    classes: [],
  });

  const children = convertSiblings(
    block.innerBlocks.filter((child) => child.blockName !== 'media-text'),
    ctx,
  );

  return {
    type: 'media_text',
    id: ctx.allocateId('media_text', block.start, block.end),
    props,
    children,
  };
}

function convertSeparator(block: ParsedGutenbergBlock, ctx: ConvertContext): BlockNode {
  const className = typeof block.attrs.className === 'string' ? block.attrs.className : '';
  const style = className.includes('is-style-wide') ? 'wide' : className.includes('is-style-dots') ? 'dots' : 'default';

  const props = separatorPropsSchema.parse({ style, classes: [] });

  return {
    type: 'separator',
    id: ctx.allocateId('separator', block.start, block.end),
    props,
    children: [],
  };
}

function convertFormSelector(block: ParsedGutenbergBlock, ctx: ConvertContext): BlockNode {
  const legacyId = block.attrs.formId ?? block.attrs.id;
  const legacyRef = `wpforms:${String(legacyId ?? '')}`;
  const formId = ctx.resolvers.resolveForm ? ctx.resolvers.resolveForm(legacyRef) : null;

  if (formId === null) {
    ctx.push({ severity: 'warning', code: 'unresolved-form-reference', detail: 'wpforms/form-selector' });
    const fallback = buildHtmlFallbackBlock(ctx, {
      html: `<div>[wpforms id="${String(legacyId ?? '')}"]</div>`,
      reason: 'divi_unmapped_module',
      detail: 'wpforms/form-selector',
      start: block.start,
      end: block.end,
    });
    if (fallback) return fallback as unknown as BlockNode;
    return {
      type: 'html',
      id: ctx.allocateId('html', block.start, block.end),
      props: htmlPropsSchema.parse({
        html: '<div>[wpforms]</div>',
        reason: 'divi_unmapped_module',
        detail: 'wpforms/form-selector',
        classes: [],
      }),
      children: [],
    };
  }

  const props = formPropsSchema.parse({
    formId,
    origin: 'wpforms',
    showTitle: block.attrs.displayTitle === true,
    showDescription: block.attrs.displayDesc === true,
    classes: [],
  });

  return {
    type: 'form',
    id: ctx.allocateId('form', block.start, block.end),
    props,
    children: [],
  };
}

function convertShortcodeBlock(block: ParsedGutenbergBlock, ctx: ConvertContext): BlockNode | null {
  const raw = block.innerHtml.trim();
  const match = /^\[([a-zA-Z][a-zA-Z0-9_]*)/.exec(raw);
  if (!match) {
    return buildRichTextOrFallback(ctx, block.innerHtml, { start: block.start, end: block.end }) as BlockNode | null;
  }

  const shortcode: ParsedShortcode = {
    tag: match[1]!,
    attrs: parseInlineShortcodeAttrs(raw),
    content: '',
    children: [],
    raw,
    selfClosing: true,
    start: block.start,
    end: block.end,
  };

  const result = convertNonDiviShortcode(shortcode, ctx);
  return result.block;
}

const INLINE_ATTR_RE = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function parseInlineShortcodeAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(INLINE_ATTR_RE)) {
    attrs[match[1]!] = match[2] ?? match[3] ?? '';
  }
  return attrs;
}
