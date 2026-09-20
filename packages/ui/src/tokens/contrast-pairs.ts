import type { ColorTokenName } from './tokens';
import type { ContrastRole } from './contrast';

export interface ContrastPair {
  theme: 'light' | 'dark';
  /** Coppia come dichiarata nel capitolo 2: colore in primo piano / colore di fondo. */
  fg: ColorTokenName;
  bg: ColorTokenName;
  /** Rapporto dichiarato nel documento, per il confronto d'intervallo. */
  documented: number;
  role: ContrastRole;
  note: string;
}

/**
 * Le coppie dichiarate nel capitolo 2 di `docs/design/design-system.md`, tema per
 * tema. `tests/contrast.test.ts` ricalcola ogni riga con la formula WCAG 2.2 e
 * verifica sia la soglia minima di ruolo (§9.2), sia che il valore ricalcolato
 * coincida — entro l'arrotondamento a due cifre — con quello dichiarato: un test
 * che non guardasse anche il valore dichiarato non si accorgerebbe di un token
 * scambiato per un altro con contrasto simile.
 */
export const contrastPairs: ContrastPair[] = [
  // --- Tema chiaro, §2.1 ---
  { theme: 'light', fg: 'bg-surface', bg: 'bg-app', documented: 1.08, role: 'decorative', note: 'bg-surface su bg-app' },
  { theme: 'light', fg: 'surface-hover', bg: 'bg-surface', documented: 1.12, role: 'decorative', note: 'surface-hover su bg-surface' },
  { theme: 'light', fg: 'text-primary', bg: 'surface-hover', documented: 14.44, role: 'text', note: 'text-primary su surface-hover' },
  { theme: 'light', fg: 'surface-selected', bg: 'bg-surface', documented: 1.18, role: 'decorative', note: 'surface-selected su bg-surface' },
  { theme: 'light', fg: 'text-primary', bg: 'surface-selected', documented: 13.7, role: 'text', note: 'text-primary su surface-selected' },
  { theme: 'light', fg: 'accent', bg: 'surface-selected', documented: 6.65, role: 'border-or-focus', note: 'accent su surface-selected' },
  { theme: 'light', fg: 'text-primary', bg: 'bg-surface', documented: 16.24, role: 'text', note: 'text-primary su bg-surface' },
  { theme: 'light', fg: 'text-primary', bg: 'bg-app', documented: 15.0, role: 'text', note: 'text-primary su bg-app' },
  { theme: 'light', fg: 'text-secondary', bg: 'bg-surface', documented: 7.0, role: 'text', note: 'text-secondary su bg-surface' },
  { theme: 'light', fg: 'text-secondary', bg: 'surface-hover', documented: 6.23, role: 'text', note: 'text-secondary su surface-hover' },
  { theme: 'light', fg: 'border', bg: 'bg-surface', documented: 1.37, role: 'decorative', note: 'border su bg-surface' },
  { theme: 'light', fg: 'border-strong', bg: 'bg-surface', documented: 3.51, role: 'border-or-focus', note: 'border-strong su bg-surface' },
  { theme: 'light', fg: 'accent', bg: 'bg-surface', documented: 7.88, role: 'text', note: 'accent su bg-surface' },
  { theme: 'light', fg: 'on-accent', bg: 'accent', documented: 7.88, role: 'text', note: 'on-accent su accent' },
  { theme: 'light', fg: 'accent-hover', bg: 'bg-surface', documented: 10.76, role: 'text', note: 'accent-hover su bg-surface' },
  { theme: 'light', fg: 'focus-ring', bg: 'bg-surface', documented: 4.99, role: 'border-or-focus', note: 'focus-ring su bg-surface' },
  { theme: 'light', fg: 'success', bg: 'bg-surface', documented: 6.72, role: 'text', note: 'success su bg-surface' },
  { theme: 'light', fg: 'warning', bg: 'bg-surface', documented: 6.39, role: 'text', note: 'warning su bg-surface' },
  { theme: 'light', fg: 'danger', bg: 'bg-surface', documented: 7.56, role: 'text', note: 'danger su bg-surface' },
  { theme: 'light', fg: 'restricted', bg: 'bg-surface', documented: 8.34, role: 'text', note: 'restricted su bg-surface' },
  { theme: 'light', fg: 'restricted-surface', bg: 'bg-surface', documented: 1.18, role: 'decorative', note: 'restricted-surface su bg-surface' },
  { theme: 'light', fg: 'restricted-ink', bg: 'restricted-surface', documented: 10.35, role: 'text', note: 'restricted-ink su restricted-surface' },

  // --- Tema scuro, §2.2 ---
  { theme: 'dark', fg: 'bg-surface', bg: 'bg-app', documented: 1.13, role: 'decorative', note: 'bg-surface su bg-app' },
  { theme: 'dark', fg: 'surface-hover', bg: 'bg-surface', documented: 1.12, role: 'decorative', note: 'surface-hover su bg-surface' },
  { theme: 'dark', fg: 'text-primary', bg: 'surface-hover', documented: 12.23, role: 'text', note: 'text-primary su surface-hover' },
  { theme: 'dark', fg: 'surface-selected', bg: 'bg-surface', documented: 1.21, role: 'decorative', note: 'surface-selected su bg-surface' },
  { theme: 'dark', fg: 'text-primary', bg: 'surface-selected', documented: 11.29, role: 'text', note: 'text-primary su surface-selected' },
  { theme: 'dark', fg: 'accent', bg: 'surface-selected', documented: 6.29, role: 'border-or-focus', note: 'accent su surface-selected' },
  { theme: 'dark', fg: 'text-primary', bg: 'bg-surface', documented: 13.66, role: 'text', note: 'text-primary su bg-surface' },
  { theme: 'dark', fg: 'text-secondary', bg: 'bg-surface', documented: 7.28, role: 'text', note: 'text-secondary su bg-surface' },
  { theme: 'dark', fg: 'border', bg: 'bg-surface', documented: 1.38, role: 'decorative', note: 'border su bg-surface' },
  { theme: 'dark', fg: 'border-strong', bg: 'bg-surface', documented: 3.7, role: 'border-or-focus', note: 'border-strong su bg-surface' },
  { theme: 'dark', fg: 'accent', bg: 'bg-surface', documented: 7.61, role: 'text', note: 'accent su bg-surface' },
  { theme: 'dark', fg: 'on-accent', bg: 'accent', documented: 8.61, role: 'text', note: 'on-accent su accent' },
  { theme: 'dark', fg: 'accent-hover', bg: 'bg-surface', documented: 9.72, role: 'text', note: 'accent-hover su bg-surface' },
  { theme: 'dark', fg: 'on-accent', bg: 'accent-hover', documented: 10.99, role: 'text', note: 'on-accent su accent-hover' },
  { theme: 'dark', fg: 'focus-ring', bg: 'bg-app', documented: 8.61, role: 'border-or-focus', note: 'focus-ring su bg-app' },
  { theme: 'dark', fg: 'success', bg: 'bg-surface', documented: 8.71, role: 'text', note: 'success su bg-surface' },
  { theme: 'dark', fg: 'warning', bg: 'bg-surface', documented: 7.37, role: 'text', note: 'warning su bg-surface' },
  { theme: 'dark', fg: 'danger', bg: 'bg-surface', documented: 6.23, role: 'text', note: 'danger su bg-surface' },
  { theme: 'dark', fg: 'restricted', bg: 'bg-surface', documented: 7.16, role: 'text', note: 'restricted su bg-surface' },
  { theme: 'dark', fg: 'restricted-surface', bg: 'bg-surface', documented: 1.06, role: 'decorative', note: 'restricted-surface su bg-surface' },
  { theme: 'dark', fg: 'restricted-surface', bg: 'bg-app', documented: 1.19, role: 'decorative', note: 'restricted-surface su bg-app' },
  { theme: 'dark', fg: 'restricted-ink', bg: 'restricted-surface', documented: 9.52, role: 'text', note: 'restricted-ink su restricted-surface' },
];
