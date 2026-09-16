import { schema, type Database } from '@amoris/db';

/**
 * Scrittura del registro delle operazioni (RU-05, RN-03).
 *
 * È l'unico punto che inserisce in `audit_log`: l'hook di ADR-001 §3 punto 3 lo
 * chiama per ogni richiesta che modifica dati, il modulo di autenticazione per i
 * cinque eventi di ADR-007 §3.1 controllo 10.
 *
 * `detail` non contiene mai dati personali di terzi, e l'indirizzo IP entra solo
 * come digest con sale.
 */

export interface AuditEntry {
  readonly action: string;
  readonly actorUserId?: string | null;
  readonly actorLabel?: string | null;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  readonly outcome?: 'success' | 'failure';
  readonly detail?: Record<string, unknown>;
  readonly ipHash?: Buffer | null;
  readonly sessionId?: string | null;
}

export async function writeAudit(db: Database, entry: AuditEntry): Promise<void> {
  await db.insert(schema.auditLog).values({
    action: entry.action,
    actorUserId: entry.actorUserId ?? null,
    actorLabel: entry.actorLabel ?? null,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    outcome: entry.outcome ?? 'success',
    detail: entry.detail ?? {},
    ipHash: entry.ipHash ?? null,
    sessionId: entry.sessionId ?? null,
  });
}

/** Le cinque azioni che ADR-007 §3.1 controllo 10 impone di registrare. */
export const AUTH_ACTIONS = {
  login: 'auth.login',
  logout: 'auth.logout',
  passwordChanged: 'auth.password_changed',
  sessionsRevoked: 'auth.sessions_revoked',
} as const;
