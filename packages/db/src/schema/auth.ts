import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { adminArea, auditOutcome } from './enums.js';
import { bytea, citext } from './types.js';

/**
 * Persone, ruoli, sessioni e registro delle operazioni.
 * Requisiti RU-01, RU-02, RU-05, RN-03. ADR-007.
 */

/** Chi accede all'area amministrativa. Gli utenti delle consulenze non stanno qui. */
export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: citext().notNull(),
    /** Nullo finché la persona non imposta la password. */
    passwordHash: text(),
    fullName: text().notNull(),
    isActive: boolean().notNull().default(true),
    mustChangePassword: boolean().notNull().default(false),
    lastLoginAt: timestamp({ withTimezone: true }),
    /** Segreto TOTP cifrato (AES-256-GCM); senza `totpActivatedAt` è ancora in attesa di attivazione (DR-384). */
    totpSecretEnc: text(),
    totpActivatedAt: timestamp({ withTimezone: true }),
    /** Ultimo passo da 30 secondi accettato: un codice già usato non vale due volte. */
    totpLastStep: bigint({ mode: 'number' }),
    /** `wp_users.ID`, per l'idempotenza dell'import. */
    legacyId: bigint({ mode: 'number' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('users_email_unique').on(t.email),
    unique('users_legacy_id_unique').on(t.legacyId),
  ],
);

export const roles = pgTable(
  'roles',
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull(),
    label: text().notNull(),
    description: text(),
    /** I ruoli di sistema non si cancellano. */
    isSystem: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('roles_key_unique').on(t.key)],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid()
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

/** Le autorizzazioni si esprimono come permessi, mai come confronti sul nome del ruolo. */
export const permissions = pgTable('permissions', {
  key: text().primaryKey(),
  label: text().notNull(),
  description: text(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid()
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text()
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
);

/** Sessioni opache: si conserva il digest del token, mai il token. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenDigest: bytea().notNull(),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Scadenza assoluta. */
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    userAgent: text(),
    /** Digest con sale, mai l'indirizzo in chiaro. */
    ipHash: bytea(),
    /**
     * Ruolo attivo della sessione (DR-050, attuata da DR-067): i permessi in
     * vigore sono quelli di questo ruolo, non l'unione dei ruoli posseduti.
     * Nullo finche' la persona non ha scelto, cioe' fra l'accesso e la
     * schermata di scelta dell'area.
     */
    activeRoleId: uuid().references(() => roles.id, { onDelete: 'set null' }),
    /**
     * Area in cui la persona sta lavorando (`ux-proposals.md` §4.4 punto 2): il
     * servizio rifiuta i dati di un'altra area **anche quando il permesso ci
     * sarebbe**. Nulla fra l'accesso e la scelta dell'area.
     */
    activeArea: adminArea(),
    /** Nullo finché il secondo fattore non è stato verificato: la sessione non autorizza nulla (DR-384). */
    secondFactorVerifiedAt: timestamp({ withTimezone: true }),
    /** Ultima conferma con password o codice, per le operazioni che la richiedono di nuovo (DR-391). */
    lastConfirmedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    unique('sessions_token_digest_unique').on(t.tokenDigest),
    index('sessions_user_active_idx')
      .on(t.userId)
      .where(sql`revoked_at IS NULL`),
  ],
);

/** Registro delle operazioni. Append-only: nessun UPDATE, nessun DELETE. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    /** Conservato anche se la persona viene rimossa. */
    actorLabel: text(),
    action: text().notNull(),
    entityType: text(),
    entityId: text(),
    outcome: auditOutcome().notNull().default('success'),
    /** Mai dati personali di terzi. */
    detail: jsonb().notNull().default({}),
    ipHash: bytea(),
    sessionId: uuid().references(() => sessions.id, { onDelete: 'set null' }),
    /** In quale veste l'azione e' stata compiuta (DR-067). */
    actorRoleId: uuid().references(() => roles.id, { onDelete: 'set null' }),
    /** Conservata anche se il ruolo viene rimosso, come `actorLabel`. */
    actorRoleLabel: text(),
    /** In quale area l'azione e' stata compiuta (`ux-proposals.md` §4.3). */
    actorArea: adminArea(),
  },
  (t) => [
    index('audit_log_occurred_at_idx').on(t.occurredAt.desc().nullsFirst()),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_actor_idx').on(t.actorUserId, t.occurredAt.desc().nullsFirst()),
    // Conteggio dei fallimenti per indirizzo (controllo 8): non parziale, perché l'esito arriva come parametro.
    index('audit_log_ip_idx').on(t.action, t.outcome, t.ipHash, t.occurredAt),
  ],
);
