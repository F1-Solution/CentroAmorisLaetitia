import { schema, type Database } from '@amoris/db';
import { and, eq, lt, or } from 'drizzle-orm';
import { AUTH_ACTIONS } from '../auth/audit.js';
import { IDENTIFIER_ENTITY } from '../auth/loginAttempts.js';

/** Sessioni e righe dei tentativi più vecchie di così si cancellano (R25, N4). */
export const RETENTION_DAYS = 30;

export interface PurgeResult {
  readonly sessions: number;
  readonly attempts: number;
}

/**
 * Cancella le sessioni scadute o revocate e, da più di 30 giorni, i tentativi d'accesso falliti e ogni riga con il
 * digest dell'identificativo (fallimenti di password e codice, sblocchi; DR-403); nessun'altra riga di `audit_log`.
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
        or(
          and(
            eq(schema.auditLog.action, AUTH_ACTIONS.login),
            eq(schema.auditLog.outcome, 'failure'),
          ),
          eq(schema.auditLog.entityType, IDENTIFIER_ENTITY),
        ),
        lt(schema.auditLog.occurredAt, cutoff),
      ),
    )
    .returning({ id: schema.auditLog.id });
  return { sessions: sessions.length, attempts: failures.length };
}
