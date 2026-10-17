import type { CSSProperties } from 'react';
import type { Spacing } from '../common';

/**
 * Spaziature di un blocco come proprietà personalizzate CSS (DR-071, ADR-005
 * §3.3 regola 2). L'attributo `style` porta il **valore**; la **regola** che lo
 * usa sta nel foglio di stile del sito, con il valore predefinito di Divi come
 * ripiego.
 *
 * Solo la resa React lo scrive: `content_html` non porta le proprietà di
 * presentazione (`BLOCK-MODEL.md` §6.1).
 */

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const BREAKPOINTS = { base: '', tablet: '-t', phone: '-p' } as const;

/** Padding e margini personalizzati (`custom_margin`, R di DR-157). */
const KINDS = { padding: 'pad', margin: 'mar' } as const;

/** L'elenco chiuso dei nomi ammessi in linea (criterio 1E-15). */
export const SPACING_VARIABLES: readonly string[] = Object.values(KINDS).flatMap((kind) =>
  Object.values(BREAKPOINTS).flatMap((suffix) =>
    SIDES.map((side) => `--blk-${kind}-${side}${suffix}`),
  ),
);

/** Le stesse unità di `CssLength`: lo schema le garantisce già, qui si ricontrolla. */
const LENGTH = /^-?\d+(\.\d+)?(px|em|rem|%|vh|vw)$/;

function variables(spacing: Spacing, kind: string, out: Record<string, string>): void {
  for (const [breakpoint, suffix] of Object.entries(BREAKPOINTS) as [
    keyof typeof BREAKPOINTS,
    string,
  ][]) {
    const box = spacing[breakpoint];
    if (!box) continue;
    for (const side of SIDES) {
      const value = box[side];
      if (value !== null && LENGTH.test(value)) out[`--blk-${kind}-${side}${suffix}`] = value;
    }
  }
}

export function spacingVariables(padding: Spacing, margin?: Spacing): CSSProperties | undefined {
  const out: Record<string, string> = {};
  variables(padding, KINDS.padding, out);
  if (margin) variables(margin, KINDS.margin, out);
  return Object.keys(out).length > 0 ? (out as CSSProperties) : undefined;
}
