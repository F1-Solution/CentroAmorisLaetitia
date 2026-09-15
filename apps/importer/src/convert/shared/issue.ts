/**
 * Le anomalie che i convertitori producono (`BLOCK-MODEL.md` §5.4, §7.1, ADR-005
 * §3.3 regola 4). Un convertitore non scrive mai direttamente in `import_issues`:
 * restituisce queste righe, e la fase `contents` (`1D-W4`) le persiste insieme
 * all'identificatore del contenuto e della corsa. Qui il vocabolario è chiuso,
 * come vuole `IMPORTER-DESIGN.md` §8.2: mai un frammento del contenuto reale.
 */

export type ConvertIssueSeverity = 'info' | 'warning' | 'error';

/**
 * Vocabolario chiuso. Distinto da `report/types.ts#IssueCode` perché quello è
 * il vocabolario dell'intero importer (§8.2 del design), mentre questo è quanto
 * la conversione può produrre. La fase `contents` traduce questi codici nei
 * codici del rapporto quando scrive la riga.
 */
export const CONVERT_ISSUE_CODES = [
  /** Attributo Divi non nell'elenco conservato né in quello scartato (`divi-shortcode-strategy.md` §3.1, §3.2). */
  'unknown-divi-attribute',
  /** Shortcode non riconosciuto, né Divi né della lista non-Divi (`divi-shortcode-strategy.md` §2.1). */
  'unknown-shortcode',
  /** Modulo Divi riconosciuto ma senza corrispondenza dichiarata: diventa `html`. */
  'unmapped-divi-module',
  /** Markup dentro un `et_pb_text` o un blocco Gutenberg che l'elenco chiuso non ammette (§5.4, ultima riga). */
  'unmapped-markup',
  /** `wp:html` di Gutenberg: nasce già come blocco di riserva. */
  'wp-html-block',
  /** URL relativo allo schema del sito stesso, normalizzato in forma relativa prima della sanificazione. */
  'same-site-url-normalized',
  /** Attributo o elemento rimosso dalla sanificazione di `rich_text` (§5.4). Il dettaglio dice quale. */
  'sanitize-removed',
  /** Un `use_custom_width` (o simile) attivo senza il valore atteso: anomalia della sorgente (§3.1). */
  'inconsistent-custom-width',
  /** Un valore presente ma di forma non ammessa (colore, lunghezza CSS): non si importa (§2.4). */
  'invalid-attribute-value',
  /** Un valore di `column.width` che non è nell'enumerazione misurata (`BLOCK-MODEL.md` §3.3, §9 punto 2). */
  'unexpected-column-width',
  /** Un parametro di `[catposts]` non fra quelli riconosciuti (`BLOCK-MODEL.md` §3.11, §9 punto 3). */
  'unexpected-catposts-param',
  /** `src` di un'immagine o di un video non risolto in un riferimento al media. */
  'unresolved-media-reference',
  /** Un form (WPForms o Divi) senza corrispondenza nella tabella `forms`. */
  'unresolved-form-reference',
  /** Un documento `[doc]`/`wpdmpro` senza corrispondenza nella tabella `documents`. */
  'unresolved-document-reference',
  /** Uno slider Slider Revolution senza corrispondenza nella tabella `sliders`. */
  'unresolved-slider-reference',
] as const;

export type ConvertIssueCode = (typeof CONVERT_ISSUE_CODES)[number];

export interface ConvertIssue {
  readonly severity: ConvertIssueSeverity;
  readonly code: ConvertIssueCode;
  /** Nome del modulo, dell'attributo o dell'elemento coinvolto — mai il contenuto. */
  readonly detail: string | null;
}

/** Elenco mutabile usato durante una conversione; il chiamante lo consuma a fine conversione. */
export function createIssueSink(): { readonly issues: ConvertIssue[]; push: (issue: ConvertIssue) => void } {
  const issues: ConvertIssue[] = [];
  return {
    issues,
    push(issue: ConvertIssue): void {
      issues.push(issue);
    },
  };
}
