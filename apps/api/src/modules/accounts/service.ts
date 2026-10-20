import { ACCOUNT_ROLE_KEYS, type AccountRoleKey, type UpdateAccountBody } from '@amoris/contracts';
import { schema, type Database } from '@amoris/db';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { PERMISSIONS } from '../../auth/permissions.js';
import type { Config } from '../../config.js';
import { generateTemporaryPassword, hashPassword } from '../../lib/password.js';

/**
 * Servizio del dominio `accounts` (wave 1G-W1). Le rotte non toccano il database
 * (ADR-001 §3 punto 2); la password temporanea esce solo come valore di ritorno.
 */

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Reader = Database | Transaction;

/** Revoca nella stessa transazione della modifica: un 409 la annulla, un commit la rende certa. */
async function revokeSessionsIn(tx: Transaction, userId: string): Promise<void> {
  await tx
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}

export interface AccountRow {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly isActive: boolean;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly roleKeys: string[];
}

const accountColumns = {
  id: schema.users.id,
  email: schema.users.email,
  fullName: schema.users.fullName,
  isActive: schema.users.isActive,
  lastLoginAt: schema.users.lastLoginAt,
  createdAt: schema.users.createdAt,
};

async function withRoleKeys(
  db: Reader,
  users: readonly Omit<AccountRow, 'roleKeys'>[],
): Promise<AccountRow[]> {
  if (users.length === 0) return [];
  const rows = await db
    .select({ userId: schema.userRoles.userId, key: schema.roles.key })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(
      inArray(
        schema.userRoles.userId,
        users.map((user) => user.id),
      ),
    );
  return users.map((user) => ({
    ...user,
    roleKeys: rows
      .filter((row) => row.userId === user.id)
      .map((row) => row.key)
      .sort(),
  }));
}

export async function listAccounts(db: Database): Promise<AccountRow[]> {
  const users = await db
    .select(accountColumns)
    .from(schema.users)
    .orderBy(asc(schema.users.fullName), asc(schema.users.email));
  return withRoleKeys(db, users);
}

export async function findAccount(db: Database, id: string): Promise<AccountRow | null> {
  const users = await db.select(accountColumns).from(schema.users).where(eq(schema.users.id, id));
  const [account] = await withRoleKeys(db, users);
  return account ?? null;
}

/** Gli id dei ruoli richiesti, o `null` se uno manca a database. */
async function roleIdsOf(db: Reader, keys: readonly AccountRoleKey[]): Promise<string[] | null> {
  const unique = [...new Set(keys)];
  const rows = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(inArray(schema.roles.key, unique));
  return rows.length === unique.length ? rows.map((row) => row.id) : null;
}

export type CreateResult =
  | { readonly kind: 'created'; readonly id: string; readonly temporaryPassword: string }
  | { readonly kind: 'email_taken' }
  | { readonly kind: 'unknown_role' };

export async function createAccount(
  db: Database,
  config: Config,
  input: { readonly email: string; readonly fullName: string; readonly roleKeys: AccountRoleKey[] },
  actorUserId: string,
): Promise<CreateResult> {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword, config);
  return db.transaction(async (tx) => {
    const roleIds = await roleIdsOf(tx, input.roleKeys);
    if (!roleIds) return { kind: 'unknown_role' } as const;
    const [user] = await tx
      .insert(schema.users)
      .values({
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName,
        passwordHash,
        mustChangePassword: true,
      })
      .onConflictDoNothing({ target: schema.users.email })
      .returning({ id: schema.users.id });
    if (!user) return { kind: 'email_taken' } as const;
    await tx
      .insert(schema.userRoles)
      .values(roleIds.map((roleId) => ({ userId: user.id, roleId, grantedBy: actorUserId })));
    return { kind: 'created', id: user.id, temporaryPassword } as const;
  });
}

/** Persone attive che possono ancora gestire gli account: per permesso, non per nome di ruolo. */
async function activeAdministrators(tx: Transaction): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(distinct ${schema.users.id})::int` })
    .from(schema.users)
    .innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
    .innerJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.userRoles.roleId))
    .where(
      and(
        eq(schema.users.isActive, true),
        eq(schema.rolePermissions.permissionKey, PERMISSIONS.usersManage),
      ),
    );
  return row?.count ?? 0;
}

/** Annulla la transazione quando resterebbe nessuna amministrazione attiva. */
class LastAdministrator extends Error {}

export type UpdateResult =
  | { readonly kind: 'updated' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unknown_role' }
  | { readonly kind: 'last_admin' };

/** Sostituisce i soli ruoli assegnabili (DR-229): gli altri ruoli della persona restano com'erano. */
async function replaceRoles(
  tx: Transaction,
  userId: string,
  roleIds: readonly string[],
  actorUserId: string,
): Promise<boolean> {
  const current = await tx
    .select({ roleId: schema.userRoles.roleId })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(
      and(eq(schema.userRoles.userId, userId), inArray(schema.roles.key, [...ACCOUNT_ROLE_KEYS])),
    );
  const removed = current.filter((row) => !roleIds.includes(row.roleId)).map((row) => row.roleId);
  if (removed.length > 0) {
    await tx
      .delete(schema.userRoles)
      .where(and(eq(schema.userRoles.userId, userId), inArray(schema.userRoles.roleId, removed)));
  }
  await tx
    .insert(schema.userRoles)
    .values(roleIds.map((roleId) => ({ userId, roleId, grantedBy: actorUserId })))
    .onConflictDoNothing();
  return removed.length > 0;
}

/**
 * Le modifiche agli account passano una alla volta (blocco consultivo della
 * transazione), così due richieste concorrenti non possono entrambe lasciare a
 * zero le amministrazioni attive (W1-5).
 */
export async function updateAccount(
  db: Database,
  id: string,
  patch: UpdateAccountBody,
  actorUserId: string,
): Promise<UpdateResult> {
  try {
    const result = await db.transaction(async (tx): Promise<UpdateResult> => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('accounts.administration'))`);
      const [target] = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .for('update');
      if (!target) return { kind: 'not_found' };
      // Prima di scrivere: un ritorno anticipato chiude la transazione con un commit.
      const roleIds = patch.roleKeys ? await roleIdsOf(tx, patch.roleKeys) : undefined;
      if (roleIds === null) return { kind: 'unknown_role' };

      if (patch.fullName !== undefined || patch.isActive !== undefined) {
        await tx
          .update(schema.users)
          .set({ fullName: patch.fullName, isActive: patch.isActive, updatedAt: new Date() })
          .where(eq(schema.users.id, id));
      }
      // Un ruolo tolto chiude le sessioni: la veste attiva potrebbe essere proprio quella (§6 caso 3).
      const removedRole = roleIds ? await replaceRoles(tx, id, roleIds, actorUserId) : false;
      if ((patch.isActive === false || patch.roleKeys) && (await activeAdministrators(tx)) === 0) {
        throw new LastAdministrator();
      }
      if (removedRole || patch.isActive === false) await revokeSessionsIn(tx, id);
      return { kind: 'updated' };
    });
    return result;
  } catch (caught) {
    if (caught instanceof LastAdministrator) return { kind: 'last_admin' };
    throw caught;
  }
}

/** Nuova password temporanea, cambio imposto al prossimo accesso, sessioni chiuse; `null` se l'account non c'è. */
export async function resetPassword(
  db: Database,
  config: Config,
  id: string,
): Promise<string | null> {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword, config);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.users)
      .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning({ id: schema.users.id });
    if (!row) return null;
    await revokeSessionsIn(tx, id);
    return temporaryPassword;
  });
}
