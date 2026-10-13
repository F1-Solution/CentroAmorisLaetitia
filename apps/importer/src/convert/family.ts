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
const GUTENBERG_BLOCK_NAMES = /<!--\s*\/?wp:([a-z0-9/-]+)/g;
const DIVI_MARKER = /\[et_pb_[a-z_]+/;

/** Il marcatore `wp:divi/placeholder` che racchiude shortcode Divi è Divi (ADR-005 §1). */
function isDiviInPlaceholder(postContent: string): boolean {
  if (!DIVI_MARKER.test(postContent)) return false;
  for (const match of postContent.matchAll(GUTENBERG_BLOCK_NAMES)) {
    if (match[1] !== 'divi/placeholder') return false;
  }
  return true;
}

export function detectContentFamily(postContent: string): ContentFamily {
  if (GUTENBERG_MARKER.test(postContent)) {
    return isDiviInPlaceholder(postContent) ? 'divi' : 'gutenberg';
  }
  if (DIVI_MARKER.test(postContent)) {
    return 'divi';
  }
  return 'html';
}
