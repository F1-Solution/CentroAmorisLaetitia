/**
 * Ricalcolo dei rapporti di contrasto, capitolo 2 e §9.2 di
 * `docs/design/design-system.md`. Formula della luminanza relativa di WCAG 2.2
 * (stessa formula usata per WCAG 2.1 §1.4.3), applicata coppia per coppia.
 */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminanza relativa WCAG 2.2, da un colore esadecimale. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  // Destrutturare il risultato di `map` darebbe tre valori possibilmente
  // indefiniti sotto `noUncheckedIndexedAccess`: qui la terna e' sempre di tre.
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** Rapporto di contrasto WCAG 2.2 fra due colori esadecimali, arrotondato a due cifre. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

export type ContrastRole = 'text' | 'border-or-focus' | 'decorative';

/** Soglia minima per ruolo — §9.2. */
export const CONTRAST_MINIMUMS: Record<ContrastRole, number | null> = {
  text: 4.5,
  'border-or-focus': 3,
  decorative: null,
};
