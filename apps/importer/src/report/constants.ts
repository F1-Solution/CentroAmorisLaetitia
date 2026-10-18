import type { ReportRowName } from './types.js';

/**
 * Conteggi attesi, presi da `importer-spec.md` §8.1 e `database-schema.md` §6.
 * Sono conteggi **per fase**, non per tabella: la fase `media` ne crea 170, e
 * le 8 righe `media` dei documenti le crea la fase `documents` (DR-058,
 * DR-060), quindi la tabella arriva a 178 mentre questa riga resta 170.
 */
export const EXPECTED_COUNTS: Readonly<Record<ReportRowName, number | null>> = {
  /**
   * **Correzione della wave `1D-W5c`**: era 18, preso dalla tabella di
   * esempio di `importer-spec.md` §8.1. Quella tabella è un'illustrazione, e
   * `settings` è l'unica riga del rapporto che **non** compare nei volumi
   * attesi di `database-schema.md` §6 — cioè non ha una fonte autorevole.
   * Il numero vero è la dimensione del catalogo delle impostazioni
   * (`stages/settings/definitions.ts`), misurata a 15, 17 dal 2026-10-18 (DR-185). I 6 template SEO non
   * stanno qui: sono una tabella diversa, senza una riga nel rapporto.
   */
  settings: 17,
  users: 1,
  media: 170,
  media_variants: null, // "~1376": stima, non un intero fisso — IMPORTER-DESIGN.md §3.9
  terms: 4, // DR-061: 2 `category` + `wpdmcategory` + `cuar_private_file_category`
  contents: 108,
  menu_items: 64,
  forms: 26, // 25 di WPForms più il modulo di contatto di Divi (DR-094)
  form_submissions: 425,
  documents: 8,
  slider_slides: 12,
  redirects: 181, // DR-065: 170 pagine allegato, non 169
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
