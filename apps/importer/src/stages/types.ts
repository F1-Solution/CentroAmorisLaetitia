/**
 * Il contratto di una fase (`IMPORTER-DESIGN.md` §4.1). In questa wave (`1D-W2`)
 * nessuna fase di dominio è attuata: solo `preflight` fa qualcosa di vero. Le
 * altre sedici esistono come nomi riconosciuti, con un'esecuzione che dichiara
 * apertamente di non essere ancora scritta e in quale wave arriva.
 */
export type StageName =
  | 'preflight'
  | 'settings'
  | 'users'
  | 'media'
  | 'terms'
  | 'contents'
  | 'relations'
  | 'menus'
  | 'seo'
  | 'documents'
  | 'sliders'
  | 'forms'
  | 'submissions'
  | 'legacy'
  | 'redirects'
  | 'rewrite'
  | 'verify';

export type Mode = 'plan' | 'apply';

export interface StageResult {
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly errors: number;
}

export const NOT_YET_IMPLEMENTED: StageResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

/** In quale wave ciascuna fase arriva, secondo `PLAN.md` §1. */
export const STAGE_INTRODUCED_IN_WAVE: Readonly<Record<StageName, string>> = {
  preflight: '1D-W2',
  settings: '1D-W4',
  users: '1D-W4',
  media: '1D-W4',
  terms: '1D-W4',
  contents: '1D-W4',
  relations: '1D-W4',
  menus: '1D-W4',
  seo: '1D-W4',
  documents: '1D-W4',
  sliders: '1D-W4',
  forms: '1D-W5',
  submissions: '1D-W5',
  legacy: '1D-W5',
  redirects: '1D-W5',
  rewrite: '1D-W5',
  verify: '1D-W5',
};

/** L'ordine obbligato di `importer-spec.md` §4: ogni fase dipende dalla precedente elencata. */
export const STAGE_DEPENDS_ON: Readonly<Record<StageName, readonly StageName[]>> = {
  preflight: [],
  settings: ['preflight'],
  users: ['preflight'],
  media: ['users'],
  terms: ['preflight'],
  contents: ['media', 'terms'],
  relations: ['contents'],
  menus: ['contents', 'terms'],
  seo: ['contents'],
  documents: ['media', 'terms'],
  sliders: ['media'],
  forms: ['preflight'],
  submissions: ['forms'],
  legacy: ['preflight'],
  redirects: ['contents', 'media', 'documents'],
  rewrite: ['contents', 'media'],
  verify: [
    'settings',
    'users',
    'media',
    'terms',
    'contents',
    'relations',
    'menus',
    'seo',
    'documents',
    'sliders',
    'forms',
    'submissions',
    'legacy',
    'redirects',
    'rewrite',
  ],
};

export const ALL_STAGE_NAMES: readonly StageName[] = Object.keys(
  STAGE_DEPENDS_ON,
) as StageName[];
