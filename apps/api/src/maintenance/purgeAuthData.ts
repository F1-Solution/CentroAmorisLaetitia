import { schema, type Database } from '@amoris/db';
import { and, eq, lt, or } from 'drizzle-orm';
import { AUTH_ACTIONS } from '../auth/audit.js';

/** Sessioni e fallimenti d'accesso più vecchi di così si cancellano (R25). */
export const RETENTION_DAYS = 30;

export interface PurgeResult {
  readonly sessions: number;
  readonly loginFailures: number;
}

/**
 * Cancella le sessioni scadute o revocate e i tentativi d'accesso falliti (rifiuti per troppi tentativi
 * compresi) da più di 30 giorni; nessun'altra riga di `audit_log`.
 */
export async function purgeAuthData(db: Database, now: Date = new Date()): Promise<PurgeResult> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000);
  const sessions = await db
    .delete(schema.sessions)
    .where(or(lt(schema.sessions.expiresAt, cutoff), lt(schema.sessions.revokedAt, cutoff)))
    .returning({ id: schema.sessions.id });
  const failures = await db
    .delete(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.action, AUTH_ACTIONS.login),
        eq(schema.auditLog.outcome, 'failure'),
        lt(schema.auditLog.occurredAt, cutoff),
      ),
    )
    .returning({ id: schema.auditLog.id });
  return { sessions: sessions.length, loginFailures: failures.length };
}
