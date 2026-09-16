import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Primitive crittografiche del servizio. Stanno qui e in nessun altro posto:
 * ADR-007 §6 chiede che il percorso di autenticazione sia leggibile per intero,
 * e lo è solo se non è sparso.
 */

/** ADR-007 §3.1 controllo 2: 256 bit da generatore crittografico. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** A database si conserva questo, mai il token. */
export function tokenDigest(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/**
 * ADR-007 §3.1 controllo 7: il token anti-CSRF si **deriva** dal token di
 * sessione, così che valga per quella sessione e non per un'altra. Il server non
 * conserva nulla in più: lo ricalcola dal cookie che ha appena ricevuto.
 */
export function csrfTokenForSession(sessionToken: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionToken, 'utf8').digest('base64url');
}

/** Digest con sale dell'indirizzo IP: a registro non finisce mai l'indirizzo. */
export function hashAddress(address: string | undefined, salt: string): Buffer | null {
  if (!address) return null;
  return createHmac('sha256', salt).update(address, 'utf8').digest();
}

/** Confronto a tempo costante, tollerante a lunghezze diverse. */
export function constantTimeEquals(a: string, b: string): boolean {
  const first = createHash('sha256').update(a, 'utf8').digest();
  const second = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(first, second);
}
