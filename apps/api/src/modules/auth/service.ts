import { schema, type Database } from '@amoris/db';
import { eq } from 'drizzle-orm';
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
}

export async function findByEmail(db: Database, email: string): Promise<Credentials | null> {
  const [row] = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      passwordHash: schema.users.passwordHash,
      isActive: schema.users.isActive,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email.trim()))
    .limit(1);
  return row ?? null;
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

export async function setPassword(
  db: Database,
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
