import type { ReportRowName } from './types.js';

/** Conteggi attesi, presi da `importer-spec.md` §8.1 e `database-schema.md` §6. */
export const EXPECTED_COUNTS: Readonly<Record<ReportRowName, number | null>> = {
  settings: 18,
  users: 1,
  media: 170,
  media_variants: null, // "~1376": stima, non un intero fisso — IMPORTER-DESIGN.md §3.9
  terms: 3,
  contents: 108,
  menu_items: 64,
  forms: 25,
  form_submissions: 425,
  documents: 8,
  slider_slides: 12,
  redirects: 180,
};

/** In quale wave ciascuna riga del rapporto diventa vera, secondo `PLAN.md` §1. */
export const ROW_IMPLEMENTED_IN_WAVE: Readonly<Record<ReportRowName, string>> = {
  settings: '1D-W4',
  users: '1D-W4',
  media: '1D-W4',
  media_variants: '1D-W4',
  terms: '1D-W4',
  contents: '1D-W4',
  menu_items: '1D-W4',
  forms: '1D-W5',
  form_submissions: '1D-W5',
  documents: '1D-W4',
  slider_slides: '1D-W4',
  redirects: '1D-W5',
};

export const ALL_REPORT_ROWS: readonly ReportRowName[] = Object.keys(
  EXPECTED_COUNTS,
) as ReportRowName[];
