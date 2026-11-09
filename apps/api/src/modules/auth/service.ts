import { schema, type Database } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { AUTH_ACTIONS, writeAudit } from '../../auth/audit.js';
import { consumeCode } from '../../auth/totp.js';
import {
  evaluateAttempts,
  identifierDigest,
  IDENTIFIER_ENTITY,
  oneAtATime,
} from '../../auth/loginAttempts.js';
import type { Config } from '../../config.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';

/**
 * Servizio del dominio `auth`. Le rotte non toccano il database: ADR-001 §3
 * punto 2.
 */

export interface Credentials {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly passwordHash: string | null;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  readonly totpActive: boolean;
}

export async function findByEmail(db: Database, email: string): Promise<Credentials | null> {
  const [row] = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      passwordHash: schema.users.passwordHash,
      isActive: schema.users.isActive,
      mustChangePassword: schema.users.mustChangePassword,
      totpActivatedAt: schema.users.totpActivatedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email.trim()))
    .limit(1);
  if (!row) return null;
  const { totpActivatedAt, ...rest } = row;
  return { ...rest, totpActive: totpActivatedAt !== null };
}

/**
 * ADR-007 §3.1 controllo 9: quando l'account non esiste si verifica comunque
 * una password contro un hash finto, così che il lavoro svolto — e quindi il
 * tempo — sia lo stesso del caso in cui esiste. Senza, il tempo di risposta
 * direbbe quali indirizzi sono registrati.
 */
let decoyHash: Promise<string> | null = null;

export function decoyVerification(config: Config): Promise<string> {
  decoyHash ??= hashPassword(crypto.randomUUID() + crypto.randomUUID(), config);
  return decoyHash;
}

export async function checkPassword(
  candidate: Credentials | null,
  password: string,
  config: Config,
): Promise<boolean> {
  if (!candidate?.passwordHash || !candidate.isActive) {
    await verifyPassword(await decoyVerification(config), password);
    return false;
  }
  return verifyPassword(candidate.passwordHash, password);
}

/** Chi agisce con la propria sessione: i dati che servono a contare e registrare un fallimento. */
export interface SessionActor {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly sessionId: string;
}

export type CurrentPasswordVerdict = 'ok' | 'invalid' | 'blocked';

/**
 * Verifica la password attuale della sessione con il conteggio dei tentativi del
 * controllo 8, unico per `/auth/password` e per le modifiche al proprio account
 * (DR-288); un fallimento lascia la riga a registro che il conteggio legge.
 */
export async function verifyCurrentPassword(
  db: Database,
  config: Config,
  actor: SessionActor,
  password: string,
  ipHash: Buffer | null,
  /** `account`: la verifica viene da una modifica dell'account, e la riga di conteggio non si mostra nel registro. */
  source: 'password' | 'account' = 'password',
): Promise<CurrentPasswordVerdict> {
  return countedAttempt(
    db,
    config,
    actor,
    ipHash,
    AUTH_ACTIONS.passwordChanged,
    async () => checkPassword(await findByEmail(db, actor.email), password, config),
    source === 'account' ? { source } : {},
  );
}

/**
 * Verifica un codice del secondo fattore con il conteggio dei tentativi del controllo 8, per account e per
 * indirizzo, come la password (DR-384); un fallimento lascia la riga a registro che il conteggio legge, mai il codice.
 */
export async function verifyCode(
  db: Database,
  config: Config,
  actor: SessionActor,
  code: string,
  ipHash: Buffer | null,
  purpose: 'activate' | 'verify' | 'confirm',
): Promise<CurrentPasswordVerdict> {
  return countedAttempt(
    db,
    config,
    actor,
    ipHash,
    AUTH_ACTIONS.secondFactor,
    () => consumeCode(db, config, actor.userId, code),
    { purpose },
  );
}

/** Conteggio, verifica e fallimento nella coda dell'account (DR-400); il ritardo progressivo si sconta fuori dalla coda. */
async function countedAttempt(
  db: Database,
  config: Config,
  actor: SessionActor,
  ipHash: Buffer | null,
  action: string,
  check: () => Promise<boolean>,
  detail: Record<string, string>,
): Promise<CurrentPasswordVerdict> {
  const { delayMs, verdict } = await oneAtATime(actor.email, async () => {
    const attempts = await evaluateAttempts(db, config, actor.email, ipHash, action);
    const outcome = (verdict: CurrentPasswordVerdict) => ({ delayMs: attempts.delayMs, verdict });
    if (attempts.blocked) return outcome('blocked');
    if (await check()) return outcome('ok');
    await writeAudit(db, {
      action,
      outcome: 'failure',
      actorUserId: actor.userId,
      actorLabel: actor.fullName,
      // Lo stesso digest dell'accesso: è la chiave del conteggio per account.
      entityType: IDENTIFIER_ENTITY,
      entityId: identifierDigest(actor.email, config.IP_HASH_SALT),
      sessionId: actor.sessionId,
      ipHash,
      detail,
    });
    return outcome('invalid');
  });
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  return verdict;
}

export async function setPassword(
  db: Pick<Database, 'update'>,
  config: Config,
  userId: string,
  newPassword: string,
): Promise<void> {
  await db
    .update(schema.users)
    .set({
      passwordHash: await hashPassword(newPassword, config),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId));
}

export async function markLogin(db: Database, userId: string): Promise<void> {
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
}
