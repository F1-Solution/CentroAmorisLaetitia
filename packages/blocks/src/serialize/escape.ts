/**
 * Regole di scaping condivise da sanificatore e serializzatore
 * (`BLOCK-MODEL.md` §6.3, regole 5, 6, 7).
 */

/** Dentro un valore di attributo: `&`, `<`, `"`. Nient'altro. */
export function escapeAttributeValue(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/** Nel testo: `&`, `<`, `>`. Nient'altro. */
export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Elementi vuoti: si scrivono senza barra finale e senza tag di chiusura. */
export const VOID_ELEMENTS = new Set(['br', 'hr', 'img']);
