/**
 * Valori dei token di colore, capitolo 2 di `docs/design/design-system.md`.
 *
 * Questa è la sorgente di verità dei 36 valori esadecimali (18 nomi, due temi).
 * `tokens.css` dichiara le stesse coppie come variabili CSS native: il test
 * `tests/tokens-css-sync.test.ts` verifica che i due file non divergano, e
 * `tests/contrast.test.ts` ricalcola ogni rapporto di contrasto dichiarato nel
 * capitolo 2 con la formula della luminanza relativa di WCAG 2.2.
 */

export type ColorTokenName =
  | 'bg-app'
  | 'bg-surface'
  | 'surface-hover'
  | 'surface-selected'
  | 'text-primary'
  | 'text-secondary'
  | 'border'
  | 'border-strong'
  | 'accent'
  | 'on-accent'
  | 'accent-hover'
  | 'focus-ring'
  | 'success'
  | 'warning'
  | 'danger'
  | 'restricted'
  | 'restricted-surface'
  | 'restricted-ink';

export type ColorTokens = Record<ColorTokenName, string>;

/** Tema chiaro — §2.1. */
export const lightColorTokens: ColorTokens = {
  'bg-app': '#F4F6F9',
  'bg-surface': '#FFFFFF',
  'surface-hover': '#EEF2F7',
  'surface-selected': '#E3EDF7',
  'text-primary': '#17212E',
  'text-secondary': '#4E5A6B',
  border: '#D7DDE5',
  'border-strong': '#7E8A99',
  accent: '#14538F',
  'on-accent': '#FFFFFF',
  'accent-hover': '#0F3F6D',
  'focus-ring': '#0A6FD1',
  success: '#15693F',
  warning: '#8A5200',
  danger: '#A3201A',
  restricted: '#6D28A8',
  'restricted-surface': '#F2E9FB',
  'restricted-ink': '#4B1C75',
};

/** Tema scuro — §2.2. Definito ora; verificato solo il tema chiaro (DR-051, §2.4). */
export const darkColorTokens: ColorTokens = {
  'bg-app': '#0F151C',
  'bg-surface': '#19212B',
  'surface-hover': '#202A36',
  'surface-selected': '#23303F',
  'text-primary': '#E7ECF2',
  'text-secondary': '#A2AFBF',
  border: '#2E3945',
  'border-strong': '#6C7A8A',
  accent: '#7FB6F0',
  'on-accent': '#0F151C',
  'accent-hover': '#A6CCF5',
  'focus-ring': '#7FB6F0',
  success: '#5FD39A',
  warning: '#E2A33A',
  danger: '#F08076',
  restricted: '#C39BF0',
  'restricted-surface': '#2B1F3D',
  'restricted-ink': '#D9C2F7',
};

export const colorTokensByTheme = {
  light: lightColorTokens,
  dark: darkColorTokens,
} as const;

/** Unità di base 4 px, scala dello spazio — §4.1. */
export const spaceTokens = {
  'space-1': '0.25rem',
  'space-2': '0.5rem',
  'space-3': '0.75rem',
  'space-4': '1rem',
  'space-6': '1.5rem',
  'space-8': '2rem',
  'space-12': '3rem',
  'space-16': '4rem',
} as const;

/** Raggio unico degli angoli — §4.1, [fissato in 1D-W7]. */
export const radiusToken = '0.25rem';

/** Punti di rottura — §4.3. */
export const breakpoints = {
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1600,
} as const;

export type DensityName = 'comfortable' | 'compact';

/** Le due densità — §5.1. `comfortable` (comoda) è la predefinita (DR-054). */
export const densityTokens: Record<DensityName, { rowHeight: string; controlHeight: string; fieldGapY: string; cellGapX: string }> = {
  comfortable: {
    rowHeight: '2.75rem', // 44px
    controlHeight: '2.5rem', // 40px
    fieldGapY: spaceTokens['space-4'], // 16px
    cellGapX: spaceTokens['space-4'], // 16px
  },
  compact: {
    rowHeight: '2.25rem', // 36px
    controlHeight: '2.25rem', // 36px
    fieldGapY: spaceTokens['space-3'], // 12px
    cellGapX: spaceTokens['space-3'], // 12px
  },
};

/** Scala tipografica — §3.2. Identica nelle due densità (§5.3 punto 4). */
export const typeScale = {
  xs: { rem: 0.75, lineHeight: 1.3, weight: 600 },
  sm: { rem: 0.8125, lineHeight: 1.45, weight: 400 },
  base: { rem: 0.875, lineHeight: 1.5, weight: 400 },
  md: { rem: 1, lineHeight: 1.6, weight: 400 },
  lg: { rem: 1.125, lineHeight: 1.35, weight: 600 },
  xl: { rem: 1.375, lineHeight: 1.3, weight: 600 },
  '2xl': { rem: 1.75, lineHeight: 1.25, weight: 700 },
} as const;
