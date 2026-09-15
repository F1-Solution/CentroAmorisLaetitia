/**
 * Interpretazione degli attributi Divi: booleani `on`/`off`, colori, lunghezze,
 * spaziatura a quattro lati, e i tre destini del §7.1 di `BLOCK-MODEL.md`
 * (proprietà tipizzata, scartato senza conteggio, sconosciuto e contato).
 */
import { ColorValue, CssLength, emptySpacing, type Box, type Spacing } from '../shared/blocks.js';
import type { ConvertContext } from '../shared/context.js';

export function diviBool(value: string | undefined): boolean {
  return value === 'on';
}

export function isValidColor(value: string): boolean {
  return ColorValue.safeParse(value).success;
}

export function isValidCssLength(value: string): boolean {
  return CssLength.safeParse(value).success;
}

/**
 * `custom_padding`: quattro valori separati da `|`, nell'ordine
 * `top|right|bottom|left`, con un quinto segmento facoltativo (il flag
 * "important" dell'editor, che non si conserva). Un valore vuoto in un lato
 * significa "non impostato", non zero.
 */
export function parseDiviBox(value: string | undefined): Box | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }
  const segments = value.split('|');
  const [top, right, bottom, left] = segments;
  const parts = [top, right, bottom, left].map((segment) => {
    const trimmed = (segment ?? '').trim();
    if (trimmed === '') return null;
    return isValidCssLength(trimmed) ? trimmed : null;
  });
  const [t, r, b, l] = parts;
  if (t === null && r === null && b === null && l === null) {
    return null;
  }
  return { top: t ?? null, right: r ?? null, bottom: b ?? null, left: l ?? null };
}

export function parseDiviSpacing(attrs: Readonly<Record<string, string>>, baseKey: string): Spacing {
  const base = parseDiviBox(attrs[baseKey]);
  const tablet = parseDiviBox(attrs[`${baseKey}_tablet`]);
  const phone = parseDiviBox(attrs[`${baseKey}_phone`]);
  if (base === null && tablet === null && phone === null) {
    return emptySpacing;
  }
  return { base, tablet, phone };
}

/**
 * Gli attributi che il §3.2 di `divi-shortcode-strategy.md` scarta di proposito:
 * niente riga di anomalia, perché è già deciso che non producono resa.
 */
const DISCARDED_ATTRIBUTE_PATTERNS: readonly RegExp[] = [
  /^admin_label$/,
  /^_builder_version$/,
  /^global_colors_info$/,
  /^_module_preset$/,
  /^theme_builder_area$/,
  /^_unique_id$/,
  /^hover_enabled$/,
  /__hover_enabled$/,
  /__hover$/,
  /^sticky_enabled$/,
  /^use_border_color$/,
  /^border_style$/,
  /^border_color$/,
  /^animation$/,
  /^animation_style$/,
  /^animation_direction$/,
  /^allow_player_pause$/,
  /^parallax_method$/,
  /^disabled$/,
];

export function isDiscardedDiviAttribute(name: string): boolean {
  return DISCARDED_ATTRIBUTE_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Registra come `unknown-divi-attribute` ogni attributo che non è né fra
 * quelli letti esplicitamente da un convertitore di modulo (`known`) né fra
 * quelli scartati di proposito. Va chiamata **dopo** aver letto tutti gli
 * attributi conservati di un modulo (§7.1).
 */
export function reportUnknownDiviAttributes(
  ctx: ConvertContext,
  moduleTag: string,
  attrs: Readonly<Record<string, string>>,
  known: ReadonlySet<string>,
): void {
  for (const name of Object.keys(attrs)) {
    if (known.has(name) || isDiscardedDiviAttribute(name)) {
      continue;
    }
    ctx.push({ severity: 'warning', code: 'unknown-divi-attribute', detail: `${moduleTag}.${name}` });
  }
}
