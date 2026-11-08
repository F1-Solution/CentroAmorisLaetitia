import { schema, type Database } from '@amoris/db';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { Config } from '../config.js';
import { AUTH_ACTIONS, writeAudit } from './audit.js';
import { revokeAllSessions } from './sessions.js';

/**
 * Secondo fattore TOTP (RFC 6238, HOTP di RFC 4226, HMAC-SHA1, 6 cifre, passo di 30 secondi) scritto
 * con `node:crypto`, senza dipendenze (DR-384, DR-388). Il segreto sta a database cifrato con AES-256-GCM.
 */

export const STEP_SECONDS = 30;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ISSUER = 'Amoris Laetitia';

/** Base32 di RFC 4648, senza imbottitura. */
export function base32Encode(bytes: Buffer): string {
  let out = '';
  let value = 0;
  let bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    for (; bits >= 5; bits -= 5) out += ALPHABET[(value >>> (bits - 5)) & 31];
    value &= (1 << bits) - 1;
  }
  return bits > 0 ? out + ALPHABET[(value << (5 - bits)) & 31] : out;
}

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(message).digest();
  const truncated = mac.readUInt32BE(mac[19]! & 15) & 0x7fffffff;
  return String(truncated % 10 ** digits).padStart(digits, '0');
}

/** Il passo del codice, se è nella finestra di ±1 passo ed è successivo all'ultimo accettato; altrimenti `null`. */
export function matchStep(
  secret: Buffer,
  code: string,
  nowMs: number,
  lastStep: number,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(nowMs / 1000 / STEP_SECONDS);
  for (const step of [current - 1, current, current + 1]) {
    if (step > lastStep && timingSafeEqual(Buffer.from(code), Buffer.from(hotp(secret, step)))) {
      return step;
    }
  }
  return null;
}

/** Il segreto cifrato è `iv.tag.testo` in base64url; l'identificativo dell'utente è dato autenticato, quindi il testo non si sposta ad altri. */
export function sealSecret(secret: Buffer, keyHex: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  cipher.setAAD(Buffer.from(userId));
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
}

export function openSecret(sealed: string, keyHex: string, userId: string): Buffer {
  const [iv, tag, body] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv!);
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(body!), decipher.final()]);
}

export function otpauthUri(secret: string, account: string): string {
  const issuer = encodeURIComponent(ISSUER);
  return `otpauth://totp/${issuer}:${encodeURIComponent(account)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

/** Nuovo segreto in attesa di attivazione; `null` se il secondo fattore è già attivo. */
export async function beginEnrollment(
  db: Database,
  config: Config,
  user: { readonly userId: string; readonly email: string },
): Promise<{ readonly secret: string; readonly uri: string } | null> {
  const secret = randomBytes(20);
  const updated = await db
    .update(schema.users)
    .set({
      totpSecretEnc: sealSecret(secret, config.TOTP_ENCRYPTION_KEY, user.userId),
      totpLastStep: null,
    })
    .where(and(eq(schema.users.id, user.userId), isNull(schema.users.totpActivatedAt)))
    .returning({ id: schema.users.id });
  if (updated.length === 0) return null;
  const encoded = base32Encode(secret);
  return { secret: encoded, uri: otpauthUri(encoded, user.email) };
}

/** Consuma un codice valido: vero una sola volta per passo, anche con due richieste insieme. */
export async function consumeCode(
  db: Database,
  config: Config,
  userId: string,
  code: string,
): Promise<boolean> {
  const [user] = await db
    .select({ sealed: schema.users.totpSecretEnc, last: schema.users.totpLastStep })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!user?.sealed) return false;
  const secret = openSecret(user.sealed, config.TOTP_ENCRYPTION_KEY, userId);
  const step = matchStep(secret, code, Date.now(), user.last ?? -1);
  if (step === null) return false;
  const won = await db
    .update(schema.users)
    .set({ totpLastStep: step })
    .where(
      and(
        eq(schema.users.id, userId),
        or(isNull(schema.users.totpLastStep), lt(schema.users.totpLastStep, step)),
      ),
    )
    .returning({ id: schema.users.id });
  return won.length === 1;
}

export async function activateSecondFactor(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ totpActivatedAt: new Date() })
    .where(and(eq(schema.users.id, userId), isNull(schema.users.totpActivatedAt)));
}

/** Aggiorna l'ultima conferma della sessione; con `verified` la segna anche come verificata. */
export async function markSession(
  db: Database,
  sessionId: string,
  verified: boolean,
): Promise<void> {
  const now = new Date();
  await db
    .update(schema.sessions)
    .set({ lastConfirmedAt: now, ...(verified ? { secondFactorVerifiedAt: now } : {}) })
    .where(eq(schema.sessions.id, sessionId));
}

/** Reimpostazione da CLI per chi perde il telefono: toglie il secondo fattore, chiude le sessioni, lascia una riga di registro. */
export async function resetSecondFactor(db: Database, email: string): Promise<number | null> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .update(schema.users)
      .set({
        totpSecretEnc: null,
        totpActivatedAt: null,
        totpLastStep: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.email, email.trim()))
      .returning({ id: schema.users.id });
    if (!user) return null;
    const revoked = await revokeAllSessions(tx, user.id);
    await writeAudit(tx, {
      action: AUTH_ACTIONS.secondFactorReset,
      entityType: 'account',
      entityId: user.id,
      detail: { source: 'cli', revoked },
    });
    return revoked;
  });
}
