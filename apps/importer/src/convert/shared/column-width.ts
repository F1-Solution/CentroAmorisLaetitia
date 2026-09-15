/**
 * `column.width` (`BLOCK-MODEL.md` §3.3). Per Divi il valore è `type`,
 * quasi sempre già nella forma `\d+_\d+`: la misura sulla sorgente reale
 * (assunzione vietata 2 di `BLOCK-MODEL.md` §9) è riportata nel rapporto di
 * questa wave. Per Gutenberg si deriva dalla percentuale dichiarata in
 * `attrs.width`, o da `1_N` a parti uguali se assente.
 */
import type { ConvertContext } from './context.js';

const COLUMN_WIDTH_RE = /^\d+_\d+$/;

/** Le frazioni note usate da Gutenberg per le larghezze percentuali di colonna. */
const KNOWN_FRACTIONS: readonly (readonly [number, string])[] = [
  [100, '1_1'],
  [50, '1_2'],
  [33.33, '1_3'],
  [66.66, '2_3'],
  [25, '1_4'],
  [75, '3_4'],
  [20, '1_5'],
  [40, '2_5'],
  [60, '3_5'],
  [80, '4_5'],
  [16.66, '1_6'],
  [83.33, '5_6'],
];

function parsePercent(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const match = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

/** Deriva la larghezza di una colonna Gutenberg da `attrs.width`, o a parti uguali se assente. */
export function deriveGutenbergColumnWidth(width: unknown, siblingCount: number): string {
  const percent = parsePercent(width);
  if (percent === null) {
    const n = Math.max(siblingCount, 1);
    return `1_${n}`;
  }
  let best = KNOWN_FRACTIONS[0]!;
  let bestDiff = Infinity;
  for (const candidate of KNOWN_FRACTIONS) {
    const diff = Math.abs(candidate[0] - percent);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best[1];
}

/**
 * Convalida il `type` di una colonna Divi. Se non corrisponde alla forma
 * attesa, produce una riga `unexpected-column-width` e usa `1_1` come valore
 * di sicurezza (`width` è obbligatorio, senza un predefinito nullo).
 */
export function deriveDiviColumnWidth(type: string | undefined, ctx: ConvertContext): string {
  if (type && COLUMN_WIDTH_RE.test(type)) {
    return type;
  }
  ctx.push({ severity: 'warning', code: 'unexpected-column-width', detail: type ?? '(assente)' });
  return '1_1';
}
