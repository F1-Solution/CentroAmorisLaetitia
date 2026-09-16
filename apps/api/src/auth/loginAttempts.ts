import { schema, type Database } from '@amoris/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { Config } from '../config.js';
import { AUTH_ACTIONS } from './audit.js';

/**
 * ADR-007 §3.1 controllo 8: limitazione dei tentativi per indirizzo IP **e** per
 * account, con ritardo progressivo.
 *
 * Il conteggio si legge dal registro delle operazioni, che già deve contenere
 * ogni accesso fallito per il controllo 10. Niente stato in memoria: sopravvive
 * al riavvio del servizio e non si perde dietro un secondo processo.
 */

export interface AttemptVerdict {
  readonly blocked: boolean;
  readonly delayMs: number;
  /** Quanti tentativi falliti risultano nella finestra, il maggiore fra i due conteggi. */
  readonly failures: number;
}

/**
 * L'identificativo tentato non entra a registro in chiaro: potrebbe essere
 * l'indirizzo di una persona che con questo servizio non c'entra nulla.
 */
export function identifierDigest(identifier: string): string {
  return createHash('sha256').update(identifier.trim().toLowerCase(), 'utf8').digest('hex');
}

export const IDENTIFIER_ENTITY = 'auth.identifier';

export async function evaluateAttempts(
  db: Database,
  config: Config,
  identifier: string,
  ipHash: Buffer | null,
): Promise<AttemptVerdict> {
  const since = new Date(Date.now() - config.LOGIN_WINDOW_MINUTES * 60_000);

  const failed = and(
    eq(schema.auditLog.action, AUTH_ACTIONS.login),
    eq(schema.auditLog.outcome, 'failure'),
    gte(schema.auditLog.occurredAt, since),
  );

  const [perAccount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auditLog)
    .where(and(failed, eq(schema.auditLog.entityId, identifierDigest(identifier))));

  const perIp = ipHash
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.auditLog)
        .where(and(failed, eq(schema.auditLog.ipHash, ipHash)))
    : [{ count: 0 }];

  const accountFailures = perAccount?.count ?? 0;
  const ipFailures = perIp[0]?.count ?? 0;

  const blocked =
    accountFailures >= config.LOGIN_MAX_PER_ACCOUNT || ipFailures >= config.LOGIN_MAX_PER_IP;
  const failures = Math.max(accountFailures, ipFailures);

  return {
    blocked,
    failures,
    delayMs: Math.min(failures * config.LOGIN_DELAY_STEP_MS, config.LOGIN_DELAY_MAX_MS),
  };
}
