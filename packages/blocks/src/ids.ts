/**
 * L'identificatore dei blocchi **creati nell'area amministrativa**
 * (`BLOCK-MODEL.md` §4.3): non hanno una sorgente, quindi non hanno una chiave
 * deterministica. Sei byte da un generatore crittografico, nello stesso
 * formato di quelli derivati.
 *
 * Usa la Web Crypto API, che è la stessa in Node dalla 19 e nel browser: questo
 * modulo entra nel bundle dell'area amministrativa attraverso
 * `@amoris/blocks`, e un `import 'node:crypto'` lo farebbe fallire in fase di
 * compilazione. La derivazione dalla sorgente, che una funzione di hash
 * sincrona la richiede davvero, sta in `@amoris/blocks/import-ids`.
 */

/** Blocchi creati nell'area amministrativa (§4.3). Non è l'importer a chiamarla. */
export function generateAdminBlockId(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `b_${hex}`;
}
