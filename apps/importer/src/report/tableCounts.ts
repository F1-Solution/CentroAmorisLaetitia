/**
 * Volumi **di tabella** attesi, da `database-schema.md` §6 — distinti dai
 * conteggi **per fase** di `constants.ts` (`EXPECTED_COUNTS`). I due
 * divergono dove più fasi scrivono nella stessa tabella: la fase `media` crea
 * 170 righe `media`, la fase `documents` ne aggiunge altre 8 (DR-058,
 * DR-060), e la tabella arriva quindi a 178 mentre `EXPECTED_COUNTS.media`
 * resta 170. La fase `verify` (`importer-spec.md` §8) confronta questi
 * volumi, non quelli per fase.
 */
export type TableCountRowName =
  | 'contents'
  | 'media'
  | 'terms'
  | 'menu_items'
  | 'redirects'
  | 'forms'
  | 'form_notifications'
  | 'form_submissions'
  | 'documents'
  | 'slider_slides'
  | 'users'
  | 'content_seo';

/** `null` per `media_variants`: «circa 1.376» è una stima, non un intero fisso. */
export const EXPECTED_TABLE_COUNTS: Readonly<Record<TableCountRowName, number>> = {
  contents: 108,
  media: 178,
  terms: 4,
  menu_items: 64,
  redirects: 181, // DR-065: 170 pagine allegato, non 169
  forms: 25,
  form_notifications: 39,
  form_submissions: 425,
  documents: 8,
  slider_slides: 12,
  users: 1,
  content_seo: 2,
};

export const ALL_TABLE_COUNT_ROWS: readonly TableCountRowName[] = Object.keys(
  EXPECTED_TABLE_COUNTS,
) as TableCountRowName[];

/** Stima, non un intero fisso (`wp-to-postgres-mapping.md` §3.4): non entra in `EXPECTED_TABLE_COUNTS`. */
export const EXPECTED_MEDIA_VARIANTS_ESTIMATE = 1376;

export interface TableCountCheck {
  readonly table: TableCountRowName;
  readonly value: number;
  readonly expected: number;
  readonly ok: boolean;
}
