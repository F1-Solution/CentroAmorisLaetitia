import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIPv6 } from 'node:net';

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

/** Chiave dell'indirizzo: l'IPv4 intero, per IPv6 il prefisso /64; un IPv4 mappato in IPv6 vale come IPv4. */
export function addressPrefix(address: string): string {
  const bare = (address.split('%')[0] ?? address).toLowerCase();
  if (!isIPv6(bare)) return bare;
  const [head = '', tail] = bare.split('::');
  const side = (part: string): string[] =>
    part === ''
      ? []
      : part.split(':').flatMap((group) => {
          const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(group);
          if (!v4) return [group];
          const [, a, b, c, d] = v4.map(Number);
          return [((a! << 8) | b!).toString(16), ((c! << 8) | d!).toString(16)];
        });
  const first = side(head);
  const last = side(tail ?? '');
  const fill = tail === undefined ? [] : Array<string>(8 - first.length - last.length).fill('0');
  const groups = [...first, ...fill, ...last].map((group) => parseInt(group, 16));
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const [, , , , , , x, y] = groups;
    return [x! >> 8, x! & 255, y! >> 8, y! & 255].join('.');
  }
  return (
    groups
      .slice(0, 4)
      .map((group) => group.toString(16))
      .join(':') + '::/64'
  );
}

/** Digest con sale dell'indirizzo IP (prefisso /64 per IPv6): a registro non finisce mai l'indirizzo. */
export function hashAddress(address: string | undefined, salt: string): Buffer | null {
  if (!address) return null;
  return createHmac('sha256', salt).update(addressPrefix(address), 'utf8').digest();
}

/** Confronto a tempo costante, tollerante a lunghezze diverse. */
export function constantTimeEquals(a: string, b: string): boolean {
  const first = createHash('sha256').update(a, 'utf8').digest();
  const second = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(first, second);
}
