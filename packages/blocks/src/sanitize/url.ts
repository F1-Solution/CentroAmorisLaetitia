/**
 * Valori ammessi negli URL di `href` e `src` (`BLOCK-MODEL.md` §5.3).
 */

const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * I browser tolgono dagli URL i caratteri di controllo, anche in mezzo allo
 * schema: `java&#9;script:` viene eseguito come `javascript:`. Vanno tolti prima
 * del confronto, altrimenti il controllo guarda una stringa diversa da quella
 * che il browser eseguirà.
 */
// eslint-disable-next-line no-control-regex -- toglierli e lo scopo di questa riga.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export function isAllowedUrl(value: string): boolean {
  const cleaned = value.replace(CONTROL_CHARS, '').trim();
  if (cleaned === '') {
    return false;
  }
  /**
   * `//host/percorso` è relativo allo **schema**, non al sito: porta fuori dal
   * sito come un indirizzo assoluto, ma somiglia a un percorso interno. Va
   * rifiutato prima del controllo sul percorso, che altrimenti lo accetterebbe.
   *
   * Nella sorgente esistono riferimenti ai media in questa forma (ADR-004 §3.3).
   * Vengono normalizzati dalla riscrittura dell'importer **prima** della
   * sanificazione: se uno arriva fin qui viene scartato, e lo scarto è contato
   * in `import_issues`, non silenzioso.
   */
  if (cleaned.startsWith('//')) {
    return false;
  }
  if (cleaned.startsWith('/') || cleaned.startsWith('#')) {
    return true;
  }
  const lower = cleaned.toLowerCase();
  return ALLOWED_SCHEMES.some((scheme) => lower.startsWith(scheme));
}

export const ALLOWED_TARGET_VALUES = new Set(['_blank', '_self']);
