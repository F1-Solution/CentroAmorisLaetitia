/**
 * Da shortcode Divi a blocchi (`divi-shortcode-strategy.md` §2, `BLOCK-MODEL.md`
 * §3). Il modulo `disabled` non si converte affatto: si salta (§3.2, ultima
 * riga). Ogni attributo non conservato e non scartato di proposito produce
 * `unknown-divi-attribute` (§7.1).
 */
import {
  defaultCustomWidth,
  defaultGutter,
  emptySpacing,
  formPropsSchema,
  htmlPropsSchema,
  imagePropsSchema,
  mapPropsSchema,
  rowPropsSchema,
  sectionPropsSchema,
  videoPropsSchema,
  deriveVideoProvider,
  type BlockNode,
  type ColumnBlock,
} from '../shared/blocks.js';
import type { ConvertContext } from '../shared/context.js';
import { buildHtmlFallbackBlock } from '../shared/html-fallback.js';
import { buildRichTextOrFallback } from '../shared/rich-text.js';
import { sectionClasses, rowClasses, imageClasses, mapClasses } from '../shared/classes.js';
import { deriveDiviColumnWidth } from '../shared/column-width.js';
import { normalizeSameSiteUrlValue } from '../shared/url-normalize.js';
import { convertNonDiviShortcode } from '../shared/non-divi-shortcodes.js';
import {
  diviBool,
  isValidColor,
  isValidCssLength,
  parseDiviSpacing,
  reportUnknownDiviAttributes,
} from './attributes.js';
import type { ParsedShortcode } from './shortcodes.js';
import { parseShortcodes } from './shortcodes.js';

/** Un tratto fra moduli fatto solo di commenti HTML (es. `wp:divi/placeholder`) e spazi non si rende. */
function hasVisibleText(gap: string): boolean {
  return gap.replace(/<!--[\s\S]*?-->/g, '').trim() !== '';
}

/** Punto di ingresso: converte l'intero `post_content` di un contenuto Divi. */
export function convertDiviContent(text: string, ctx: ConvertContext): BlockNode[] {
  const roots = parseShortcodes(text);
  const blocks: BlockNode[] = [];

  let cursor = 0;
  for (const node of roots) {
    if (node.start > cursor) {
      const gap = text.slice(cursor, node.start);
      if (hasVisibleText(gap)) {
        const built = buildRichTextOrFallback(ctx, gap, { start: cursor, end: node.start });
        if (built) blocks.push(built as BlockNode);
      }
    }
    cursor = node.end;
    blocks.push(...convertDiviNode(node, ctx));
  }
  if (cursor < text.length) {
    const gap = text.slice(cursor);
    if (hasVisibleText(gap)) {
      const built = buildRichTextOrFallback(ctx, gap, { start: cursor, end: text.length });
      if (built) blocks.push(built as BlockNode);
    }
  }
  return blocks;
}

/** Converte un nodo di primo livello (o annidato) in zero o più blocchi. */
function convertDiviNode(node: ParsedShortcode, ctx: ConvertContext): BlockNode[] {
  if (diviBool(node.attrs.disabled)) {
    // «il modulo è disattivato: non si converte affatto, si salta» (§3.2).
    return [];
  }

  switch (node.tag) {
    case 'et_pb_section':
      return [convertSection(node, ctx)];
    case 'et_pb_row':
      return [convertRow(node, ctx)];
    case 'et_pb_column':
      return [convertColumn(node, ctx)];
    case 'et_pb_text':
      return maybeArray(convertText(node, ctx));
    case 'et_pb_image':
      return [convertImage(node, ctx)];
    case 'et_pb_video':
      return [convertVideo(node, ctx)];
    case 'et_pb_map':
      return [convertMap(node, ctx)];
    case 'et_pb_contact_form':
      return [convertContactForm(node, ctx)];
    case 'et_pb_map_pin':
    case 'et_pb_contact_field':
      // Proprietà del genitore, non blocchi propri (§2 di `divi-shortcode-strategy.md`).
      return [];
    default: {
      if (node.tag.startsWith('et_pb_')) {
        // Modulo Divi riconosciuto come tale (il prefisso lo dice) ma senza
        // destinazione dichiarata: va al blocco di riserva direttamente, non
        // trattato come uno shortcode non-Divi sconosciuto (§2.1 riguarda
        // shortcode fuori da Divi, non moduli Divi senza mappatura).
        const fallback = buildHtmlFallbackBlock(ctx, {
          html: node.raw,
          reason: 'divi_unmapped_module',
          detail: node.tag,
          start: node.start,
          end: node.end,
        });
        return fallback ? [fallback as unknown as BlockNode] : [];
      }
      const nonDivi = convertNonDiviShortcode(node, ctx);
      return nonDivi.block ? [nonDivi.block] : [];
    }
  }
}

function maybeArray<T>(value: T | null): T[] {
  return value === null ? [] : [value];
}

function convertSection(node: ParsedShortcode, ctx: ConvertContext) {
  const rows = node.children
    .filter((child) => child.tag === 'et_pb_row')
    .flatMap((child) => convertDiviNode(child, ctx));

  const fullWidth = diviBool(node.attrs.make_fullwidth);
  const transparentBackground = diviBool(node.attrs.transparent_background);
  const parallax = diviBool(node.attrs.parallax);
  const innerShadow = diviBool(node.attrs.inner_shadow);

  const backgroundColorRaw = node.attrs.background_color;
  let backgroundColor: string | null = null;
  if (backgroundColorRaw !== undefined) {
    if (isValidColor(backgroundColorRaw)) {
      backgroundColor = backgroundColorRaw;
    } else {
      ctx.push({
        severity: 'warning',
        code: 'invalid-attribute-value',
        detail: 'et_pb_section.background_color',
      });
    }
  }

  const useCustomWidth = diviBool(node.attrs.use_custom_width);
  const widthPx = node.attrs.custom_width_px ? Number.parseFloat(node.attrs.custom_width_px) : null;
  const widthPercent = node.attrs.custom_width_percent
    ? Number.parseFloat(node.attrs.custom_width_percent)
    : null;
  let customWidth = defaultCustomWidth;
  if (useCustomWidth) {
    if (widthPx !== null && Number.isFinite(widthPx) && widthPx > 0) {
      customWidth = { mode: 'px', value: widthPx };
    } else if (widthPercent !== null && Number.isFinite(widthPercent) && widthPercent > 0) {
      customWidth = { mode: 'percent', value: widthPercent };
    } else {
      ctx.push({ severity: 'warning', code: 'inconsistent-custom-width', detail: 'et_pb_section' });
    }
  }

  reportUnknownDiviAttributes(
    ctx,
    'et_pb_section',
    node.attrs,
    new Set([
      'make_fullwidth',
      'transparent_background',
      'background_color',
      'parallax',
      'inner_shadow',
      'use_custom_width',
      'custom_width_px',
      'custom_width_percent',
      'custom_padding',
      'custom_padding_tablet',
      'custom_padding_phone',
      'background_image',
    ]),
  );

  const classes = sectionClasses({ fullWidth, parallax, innerShadow, transparentBackground });

  const props = sectionPropsSchema.parse({
    fullWidth,
    transparentBackground,
    backgroundColor,
    backgroundMediaId: null,
    parallax,
    innerShadow,
    customWidth,
    padding: parseDiviSpacing(node.attrs, 'custom_padding') ?? emptySpacing,
    classes,
  });

  return {
    type: 'section' as const,
    id: ctx.allocateId('section', node.start, node.end),
    props,
    children: rows,
  };
}

function convertRow(node: ParsedShortcode, ctx: ConvertContext) {
  const columns = node.children
    .filter((child) => child.tag === 'et_pb_column')
    .map((child) => convertColumn(child, ctx));

  const columnStructure = columns.map((c) => c.props.width).join(',');
  const fullWidth = diviBool(node.attrs.make_fullwidth);

  const useCustomGutter = diviBool(node.attrs.use_custom_gutter);
  const gutterWidth = node.attrs.gutter_width ? Number.parseFloat(node.attrs.gutter_width) : null;
  const gutter =
    useCustomGutter && gutterWidth !== null && Number.isFinite(gutterWidth)
      ? { custom: true, width: gutterWidth }
      : defaultGutter;

  const backgroundColorRaw = node.attrs.background_color;
  let backgroundColor: string | null = null;
  if (backgroundColorRaw !== undefined) {
    if (isValidColor(backgroundColorRaw)) {
      backgroundColor = backgroundColorRaw;
    } else {
      ctx.push({
        severity: 'warning',
        code: 'invalid-attribute-value',
        detail: 'et_pb_row.background_color',
      });
    }
  }

  reportUnknownDiviAttributes(
    ctx,
    'et_pb_row',
    node.attrs,
    new Set([
      'column_structure',
      'make_fullwidth',
      'use_custom_width',
      'custom_width_px',
      'custom_width_percent',
      'use_custom_gutter',
      'gutter_width',
      'background_color',
      'background_image',
      'custom_padding',
      'custom_padding_tablet',
      'custom_padding_phone',
    ]),
  );

  const props = rowPropsSchema.parse({
    columnStructure,
    fullWidth,
    customWidth: defaultCustomWidth,
    gutter,
    backgroundColor,
    backgroundMediaId: null,
    padding: parseDiviSpacing(node.attrs, 'custom_padding'),
    classes: rowClasses({ fullWidth }),
  });

  return {
    type: 'row' as const,
    id: ctx.allocateId('row', node.start, node.end),
    props,
    children: columns,
  };
}

function convertColumn(node: ParsedShortcode, ctx: ConvertContext): ColumnBlock {
  const width = deriveDiviColumnWidth(node.attrs.type, ctx);

  reportUnknownDiviAttributes(ctx, 'et_pb_column', node.attrs, new Set(['type', 'custom_padding']));

  const children = node.children.flatMap((child) => convertDiviNode(child, ctx));

  return {
    type: 'column',
    id: ctx.allocateId('column', node.start, node.end),
    props: {
      width,
      padding: parseDiviSpacing(node.attrs, 'custom_padding'),
      classes: [],
    },
    children,
  } as ColumnBlock;
}

function convertText(node: ParsedShortcode, ctx: ConvertContext) {
  const textAlignRaw = node.attrs.text_orientation;
  const textAlign =
    textAlignRaw === 'left' ||
    textAlignRaw === 'center' ||
    textAlignRaw === 'right' ||
    textAlignRaw === 'justify'
      ? textAlignRaw
      : null;

  const backgroundLayoutRaw = node.attrs.background_layout;
  const backgroundLayout =
    backgroundLayoutRaw === 'light' || backgroundLayoutRaw === 'dark' ? backgroundLayoutRaw : null;

  const borderWidth =
    node.attrs.border_width !== undefined && isValidCssLength(node.attrs.border_width)
      ? node.attrs.border_width
      : '1px';
  const border =
    diviBool(node.attrs.use_border_color) &&
    node.attrs.border_color &&
    isValidColor(node.attrs.border_color)
      ? { color: node.attrs.border_color, width: borderWidth, style: 'solid' as const }
      : null;

  reportUnknownDiviAttributes(
    ctx,
    'et_pb_text',
    node.attrs,
    new Set([
      'text_orientation',
      'background_layout',
      'custom_padding',
      'custom_padding_tablet',
      'custom_padding_phone',
      'use_border_color',
      'border_width',
    ]),
  );

  return buildRichTextOrFallback(
    ctx,
    node.content,
    { start: node.start, end: node.end },
    {
      textAlign,
      backgroundLayout,
      border,
      padding: parseDiviSpacing(node.attrs, 'custom_padding'),
    },
  );
}

function convertImage(node: ParsedShortcode, ctx: ConvertContext) {
  const rawSrc = node.attrs.src;
  const { value: src, normalized } = rawSrc
    ? normalizeSameSiteUrlValue(rawSrc)
    : { value: undefined, normalized: false };
  if (normalized) {
    ctx.push({ severity: 'info', code: 'same-site-url-normalized', detail: 'et_pb_image.src' });
  }
  if (!src) {
    ctx.push({
      severity: 'warning',
      code: 'unresolved-media-reference',
      detail: 'et_pb_image.src',
    });
  }

  const mediaId = src && ctx.resolvers.resolveMedia ? ctx.resolvers.resolveMedia(src) : null;

  const align =
    node.attrs.align === 'left' || node.attrs.align === 'center' || node.attrs.align === 'right'
      ? node.attrs.align
      : null;
  const alignTabletRaw = node.attrs.align_tablet;
  const alignTablet =
    alignTabletRaw === 'left' || alignTabletRaw === 'center' || alignTabletRaw === 'right'
      ? alignTabletRaw
      : null;

  const forceFullWidth = diviBool(node.attrs.force_fullwidth);
  const lightbox = diviBool(node.attrs.show_in_lightbox);
  const centerOnMobile = diviBool(node.attrs.always_center_on_mobile);
  const linkNewWindow = diviBool(node.attrs.url_new_window);

  const hasAnimation = node.attrs.animation !== undefined && node.attrs.animation !== 'off';
  const animation = hasAnimation
    ? {
        style: node.attrs.animation_style ?? node.attrs.animation ?? 'fade',
        direction: node.attrs.animation_direction ?? null,
      }
    : null;

  reportUnknownDiviAttributes(
    ctx,
    'et_pb_image',
    node.attrs,
    new Set([
      'src',
      'alt',
      'title_text',
      'align',
      'align_tablet',
      'force_fullwidth',
      'url',
      'url_new_window',
      'show_in_lightbox',
      'always_center_on_mobile',
    ]),
  );

  const props = imagePropsSchema.parse({
    mediaId,
    src: mediaId ? null : (src ?? null),
    variant: null,
    alt: node.attrs.alt ?? '',
    title: node.attrs.title_text ?? null,
    caption: null,
    linkUrl: node.attrs.url ?? null,
    linkNewWindow,
    align,
    alignTablet,
    forceFullWidth,
    lightbox,
    centerOnMobile,
    animation,
    classes: imageClasses({ centerOnMobile, lightbox }),
  });

  return {
    type: 'image' as const,
    id: ctx.allocateId('image', node.start, node.end),
    props,
    children: [],
  };
}

function convertVideo(node: ParsedShortcode, ctx: ConvertContext) {
  const rawSrc = node.attrs.src ?? '';
  const { value: src, normalized: srcNormalized } = normalizeSameSiteUrlValue(rawSrc);
  const { value: posterSrc, normalized: posterNormalized } = normalizeSameSiteUrlValue(
    node.attrs.image_src ?? '',
  );
  if (srcNormalized) {
    ctx.push({ severity: 'info', code: 'same-site-url-normalized', detail: 'et_pb_video.src' });
  }
  if (posterNormalized) {
    ctx.push({
      severity: 'info',
      code: 'same-site-url-normalized',
      detail: 'et_pb_video.image_src',
    });
  }

  reportUnknownDiviAttributes(ctx, 'et_pb_video', node.attrs, new Set(['src', 'image_src']));

  const props = videoPropsSchema.parse({
    src: src || '(assente)',
    provider: deriveVideoProvider(src || ''),
    posterMediaId: null,
    posterSrc: posterSrc || null,
    classes: [],
  });

  return {
    type: 'video' as const,
    id: ctx.allocateId('video', node.start, node.end),
    props,
    children: [],
  };
}

function convertMap(node: ParsedShortcode, ctx: ConvertContext) {
  const grayscale = diviBool(node.attrs.use_grayscale_filter);
  const zoomRaw = node.attrs.zoom_level ? Number.parseInt(node.attrs.zoom_level, 10) : null;
  const zoom =
    zoomRaw !== null && Number.isInteger(zoomRaw) && zoomRaw >= 1 && zoomRaw <= 21 ? zoomRaw : null;
  const grayscaleAmountRaw = node.attrs.grayscale_filter_amount
    ? Number.parseFloat(node.attrs.grayscale_filter_amount)
    : null;
  const grayscaleAmount =
    grayscaleAmountRaw !== null &&
    Number.isFinite(grayscaleAmountRaw) &&
    grayscaleAmountRaw >= 0 &&
    grayscaleAmountRaw <= 100
      ? grayscaleAmountRaw
      : null;

  const pins = node.children
    .filter((child) => child.tag === 'et_pb_map_pin')
    .map((pin) => ({
      title: pin.attrs.title ?? null,
      lat: pin.attrs.pin_address_lat ?? pin.attrs.address_lat ?? '0',
      lng: pin.attrs.pin_address_lng ?? pin.attrs.address_lng ?? '0',
      html: pin.content.trim() === '' ? null : pin.content,
    }));

  reportUnknownDiviAttributes(
    ctx,
    'et_pb_map',
    node.attrs,
    new Set([
      'address',
      'address_lat',
      'address_lng',
      'zoom_level',
      'mouse_wheel',
      'mobile_dragging',
      'use_grayscale_filter',
      'grayscale_filter_amount',
    ]),
  );

  const props = mapPropsSchema.parse({
    address: node.attrs.address ?? '(assente)',
    lat: node.attrs.address_lat ?? '0',
    lng: node.attrs.address_lng ?? '0',
    zoom,
    mouseWheel: diviBool(node.attrs.mouse_wheel),
    mobileDragging: diviBool(node.attrs.mobile_dragging),
    grayscale,
    grayscaleAmount,
    pins,
    classes: mapClasses({ grayscale }),
  });

  return {
    type: 'map' as const,
    id: ctx.allocateId('map', node.start, node.end),
    props,
    children: [],
  };
}

function convertContactForm(node: ParsedShortcode, ctx: ConvertContext) {
  const legacyRef = `divi-contact-form:${node.attrs.title ?? node.start}`;
  const formId = ctx.resolvers.resolveForm ? ctx.resolvers.resolveForm(legacyRef) : null;

  reportUnknownDiviAttributes(
    ctx,
    'et_pb_contact_form',
    node.attrs,
    new Set(['email', 'title', 'success_message', 'custom_message']),
  );

  if (formId === null) {
    ctx.push({
      severity: 'warning',
      code: 'unresolved-form-reference',
      detail: 'et_pb_contact_form',
    });
    const fallback = buildHtmlFallbackBlock(ctx, {
      html: node.raw,
      reason: 'divi_unmapped_module',
      detail: 'et_pb_contact_form',
      start: node.start,
      end: node.end,
    });
    return (
      fallback ?? {
        type: 'html' as const,
        id: ctx.allocateId('html', node.start, node.end),
        props: htmlPropsSchema.parse({
          html: '<div>[form]</div>',
          reason: 'divi_unmapped_module',
          detail: 'et_pb_contact_form',
          classes: [],
        }),
        children: [],
      }
    );
  }

  const props = formPropsSchema.parse({
    formId,
    origin: 'divi',
    showTitle: node.attrs.title !== undefined && node.attrs.title !== '',
    showDescription: false,
    classes: [],
  });

  return {
    type: 'form' as const,
    id: ctx.allocateId('form', node.start, node.end),
    props,
    children: [],
  };
}

export type { ParsedShortcode };
