import { createHmac } from 'node:crypto';

/**
 * Il calcolo dell'app di autenticazione (RFC 6238: HMAC-SHA1, 6 cifre, passo di 30 secondi), per
 * le prove che attraversano davvero il secondo fattore (DR-384). Scritto qui, e non importato
 * dall'API, perché la prova non deve condividere il codice che sta provando.
 */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PASSO_SECONDI = 30;

/** Base32 di RFC 4648, come la mostra la schermata: spazi e imbottitura ignorati. */
export function daBase32(chiave: string): Buffer {
  const pulita = chiave.replace(/[\s=]/g, '').toUpperCase();
  const byte: number[] = [];
  let valore = 0;
  let bit = 0;
  for (const carattere of pulita) {
    const indice = ALFABETO.indexOf(carattere);
    if (indice < 0) throw new Error(`carattere non Base32 nella chiave: ${carattere}`);
    valore = (valore << 5) | indice;
    bit += 5;
    if (bit >= 8) {
      byte.push((valore >>> (bit - 8)) & 0xff);
      bit -= 8;
    }
  }
  return Buffer.from(byte);
}

export function passoCorrente(adesso = Date.now()): number {
  return Math.floor(adesso / 1000 / PASSO_SECONDI);
}

export function codiceTotp(chiave: string, passo: number): string {
  const messaggio = Buffer.alloc(8);
  messaggio.writeBigUInt64BE(BigInt(passo));
  const mac = createHmac('sha1', daBase32(chiave)).update(messaggio).digest();
  const scarto = mac[mac.length - 1]! & 0x0f;
  const troncato = mac.readUInt32BE(scarto) & 0x7fffffff;
  return String(troncato % 1_000_000).padStart(6, '0');
}
