import { schema, type Database } from '@amoris/db';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Config } from '../config.js';
import { generateSessionToken, hashAddress, tokenDigest } from '../lib/crypto.js';
import type { AdminArea } from './areas.js';
import { AREA_OF_PERMISSION } from './areaMap.js';
import { collectPermissions } from './permissions.js';

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

/** Una veste: il ruolo con cui si lavora e l'area in cui lo si fa. */
export interface RoleHeld {
  readonly roleId: string;
  readonly key: string;
  readonly label: string;
  readonly areas: readonly AdminArea[];
}

export interface ResolvedSession {
  readonly sessionId: string;
  readonly user: SessionOwner;
  /**
   * I permessi **del ruolo attivo**, non l'unione dei ruoli posseduti
   * (DR-050, attuata da DR-067). Vuoto finché la veste non è stata scelta.
   */
  readonly permissions: ReadonlySet<string>;
  readonly activeRoleId: string | null;
  readonly activeArea: AdminArea | null;
  /** Che cosa il commutatore può offrire: i ruoli posseduti e le loro aree. */
  readonly rolesHeld: readonly RoleHeld[];
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
      activeRoleId: schema.sessions.activeRoleId,
      activeArea: schema.sessions.activeArea,
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
    // Senza veste scelta non si autorizza nulla: la schermata di scelta è
    // l'unica cosa che si raggiunge, e non chiede permessi.
    permissions: row.activeRoleId ? await permissionsOfRole(db, row.activeRoleId) : new Set(),
    activeRoleId: row.activeRoleId,
    activeArea: row.activeArea,
    rolesHeld: await rolesHeldBy(db, row.userId),
  };
}

/** I permessi del ruolo attivo: sono questi, e solo questi, ad autorizzare. */
export async function permissionsOfRole(
  db: Database,
  roleId: string,
): Promise<ReadonlySet<string>> {
  const granted = await db
    .select({ permissionKey: schema.rolePermissions.permissionKey })
    .from(schema.rolePermissions)
    .where(eq(schema.rolePermissions.roleId, roleId));
  return collectPermissions(granted);
}

/**
 * I ruoli posseduti, ciascuno con le aree in cui fa entrare. Non autorizzano:
 * dicono soltanto che cosa il commutatore può offrire, e da quante voci è fatta
 * la schermata di scelta.
 *
 * L'area si raggiunge se il ruolo ha **almeno un** permesso fra quelli che le
 * rotte di quell'area richiedono. Un ruolo che non ne ha nessuno non la vede
 * nemmeno: `design-system.md` §7.3, «le aree non possedute non compaiono».
 */
export async function rolesHeldBy(db: Database, userId: string): Promise<readonly RoleHeld[]> {
  const rows = await db
    .select({
      roleId: schema.roles.id,
      key: schema.roles.key,
      label: schema.roles.label,
      permissionKey: schema.rolePermissions.permissionKey,
    })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .leftJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.userRoles.roleId))
    .where(eq(schema.userRoles.userId, userId));

  const byRole = new Map<string, { key: string; label: string; areas: Set<AdminArea> }>();
  for (const row of rows) {
    const entry = byRole.get(row.roleId) ?? { key: row.key, label: row.label, areas: new Set() };
    for (const area of AREA_OF_PERMISSION[row.permissionKey ?? ''] ?? []) entry.areas.add(area);
    byRole.set(row.roleId, entry);
  }

  return [...byRole.entries()]
    .map(([roleId, entry]) => ({
      roleId,
      key: entry.key,
      label: entry.label,
      areas: [...entry.areas].sort(),
    }))
    // Ordine stabile: la schermata di scelta non deve cambiare disposizione a
    // ogni accesso, altrimenti si sbaglia veste per abitudine.
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Sceglie la veste della sessione. È un UPDATE sul record, non un nuovo token:
 * cambiare area non è un nuovo accesso, ed è per questo che il registro delle
 * operazioni può attribuire ogni azione all'area in cui è stata compiuta.
 */
export async function setActiveContext(
  db: Database,
  sessionId: string,
  roleId: string,
  area: AdminArea,
): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ activeRoleId: roleId, activeArea: area })
    .where(eq(schema.sessions.id, sessionId));
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
