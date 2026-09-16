import { schema, type Database } from '@amoris/db';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Config } from '../config.js';
import { generateSessionToken, hashAddress, tokenDigest } from '../lib/crypto.js';
import { unionOfPermissions } from './permissions.js';

/**
 * Sessioni opache (ADR-007 §3, opzione C). Una sessione è un record: revocarla
 * è un UPDATE, non l'attesa della scadenza di un token firmato.
 */

export interface SessionOwner {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly mustChangePassword: boolean;
}

export interface ResolvedSession {
  readonly sessionId: string;
  readonly user: SessionOwner;
  readonly permissions: ReadonlySet<string>;
}

export interface IssuedSession {
  readonly token: string;
  readonly sessionId: string;
  readonly expiresAt: Date;
}

interface Origin {
  readonly ip?: string | undefined;
  readonly userAgent?: string | undefined;
}

function absoluteExpiry(config: Config, from: Date): Date {
  return new Date(from.getTime() + config.SESSION_ABSOLUTE_DAYS * 86_400_000);
}

/**
 * ADR-007 §3.1 controllo 5: il token nasce nuovo a ogni accesso. Non esiste un
 * percorso che riusi il token precedente, quindi la fissazione di sessione non
 * ha presa.
 */
export async function issueSession(
  db: Database,
  config: Config,
  userId: string,
  origin: Origin,
): Promise<IssuedSession> {
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = absoluteExpiry(config, now);

  const [row] = await db
    .insert(schema.sessions)
    .values({
      userId,
      tokenDigest: tokenDigest(token),
      issuedAt: now,
      lastSeenAt: now,
      expiresAt,
      userAgent: origin.userAgent?.slice(0, 500) ?? null,
      ipHash: hashAddress(origin.ip, config.IP_HASH_SALT),
    })
    .returning({ id: schema.sessions.id });

  if (!row) throw new Error('sessione non creata');
  return { token, sessionId: row.id, expiresAt };
}

/**
 * ADR-007 §3.1 controllo 4: entrambe le scadenze sono applicate **lato server**.
 * L'inattività si valuta su `lastSeenAt`, l'assoluta su `expiresAt`, e nessuna
 * delle due dipende da quanto dice il cookie.
 */
export async function resolveSession(
  db: Database,
  config: Config,
  token: string,
): Promise<ResolvedSession | null> {
  const now = new Date();
  const idleLimit = new Date(now.getTime() - config.SESSION_IDLE_HOURS * 3_600_000);

  const [row] = await db
    .select({
      sessionId: schema.sessions.id,
      userId: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      isActive: schema.users.isActive,
      mustChangePassword: schema.users.mustChangePassword,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenDigest, tokenDigest(token)),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, now),
        gt(schema.sessions.lastSeenAt, idleLimit),
      ),
    )
    .limit(1);

  if (!row || !row.isActive) return null;

  await db
    .update(schema.sessions)
    .set({ lastSeenAt: now })
    .where(eq(schema.sessions.id, row.sessionId));

  return {
    sessionId: row.sessionId,
    user: {
      userId: row.userId,
      email: row.email,
      fullName: row.fullName,
      mustChangePassword: row.mustChangePassword,
    },
    permissions: await permissionsOf(db, row.userId),
  };
}

/**
 * I permessi di una persona sono l'**unione** di quelli dei suoi ruoli
 * (`permissions.ts` spiega il rapporto con DR-050).
 */
export async function permissionsOf(db: Database, userId: string): Promise<ReadonlySet<string>> {
  const granted = await db
    .select({ permissionKey: schema.rolePermissions.permissionKey })
    .from(schema.userRoles)
    .innerJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.userRoles.roleId))
    .where(eq(schema.userRoles.userId, userId));
  return unionOfPermissions(granted);
}

/** ADR-007 §3.1 controllo 6: revoca immediata di una sessione. */
export async function revokeSession(db: Database, sessionId: string): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.id, sessionId), isNull(schema.sessions.revokedAt)));
}

/** Controllo 6, seconda metà: tutte le sessioni di una persona in un colpo solo. */
export async function revokeAllSessions(
  db: Database,
  userId: string,
  except?: string,
): Promise<number> {
  const rows = await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.sessions.userId, userId),
        isNull(schema.sessions.revokedAt),
        except ? sql`${schema.sessions.id} <> ${except}` : undefined,
      ),
    )
    .returning({ id: schema.sessions.id });
  return rows.length;
}

export function listSessions(db: Database, userId: string) {
  return db
    .select({
      id: schema.sessions.id,
      issuedAt: schema.sessions.issuedAt,
      lastSeenAt: schema.sessions.lastSeenAt,
      expiresAt: schema.sessions.expiresAt,
      userAgent: schema.sessions.userAgent,
    })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}
