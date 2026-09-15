/**
 * Scelta della famiglia per contenuto (`ADR-005` §1, punto 1): nessun
 * contenuto è misto, quindi la famiglia si decide una volta sola, non per
 * frammento. Un marcatore Gutenberg (`<!-- wp:`) prevale su uno shortcode Divi
 * se entrambi comparissero, perché la sorgente misurata (0 misti su 108) dice
 * che ciò non accade: la precedenza è solo una scelta deterministica per il
 * caso, non previsto, in cui accadesse comunque.
 */
export type ContentFamily = 'gutenberg' | 'divi' | 'html';

const GUTENBERG_MARKER = /<!--\s*wp:/;
const DIVI_MARKER = /\[et_pb_[a-z_]+/;

export function detectContentFamily(postContent: string): ContentFamily {
  if (GUTENBERG_MARKER.test(postContent)) {
    return 'gutenberg';
  }
  if (DIVI_MARKER.test(postContent)) {
    return 'divi';
  }
  return 'html';
}
