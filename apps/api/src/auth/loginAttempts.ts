import { schema, type Database } from '@amoris/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import type { Config } from '../config.js';
import { AUTH_ACTIONS, writeAudit } from './audit.js';

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

/** HMAC con una sottochiave di `IP_HASH_SALT`: l'indirizzo digitato non si ricava dal registro con un dizionario. */
export function identifierDigest(identifier: string, salt: string): string {
  const key = createHmac('sha256', salt).update('amoris:identifier-digest:v1', 'utf8').digest();
  return createHmac('sha256', key).update(identifier.trim().toLowerCase(), 'utf8').digest('hex');
}

export const IDENTIFIER_ENTITY = 'auth.identifier';

const queues = new Map<string, Promise<unknown>>();

/**
 * DR-400: per account conteggio, verifica e registrazione del fallimento girano uno alla volta, così una raffica
 * parallela non legge il conteggio prima delle scritture; vale per un solo processo API (ADR-007, Fase 1).
 */
export async function oneAtATime<T>(identifier: string, work: () => Promise<T>): Promise<T> {
  const key = identifier.trim().toLowerCase();
  const turn = (queues.get(key) ?? Promise.resolve()).then(work);
  const settled = turn.catch(() => undefined);
  queues.set(key, settled);
  try {
    return await turn;
  } finally {
    if (queues.get(key) === settled) queues.delete(key);
  }
}

/** `action` distingue i fallimenti contati: l'accesso, o il cambio password che verifica la password attuale. */
export async function evaluateAttempts(
  db: Database,
  config: Config,
  identifier: string,
  ipHash: Buffer | null,
  action: string = AUTH_ACTIONS.login,
): Promise<AttemptVerdict> {
  const since = new Date(Date.now() - config.LOGIN_WINDOW_MINUTES * 60_000);

  const digest = identifierDigest(identifier, config.IP_HASH_SALT);
  // I rifiuti per troppi tentativi non sono fallimenti: il blocco scade dopo l'ultimo fallimento vero.
  const failed = and(
    eq(schema.auditLog.action, action),
    eq(schema.auditLog.outcome, 'failure'),
    gte(schema.auditLog.occurredAt, since),
    sql`coalesce(${schema.auditLog.detail}->>'reason', '') <> 'too_many_attempts'`,
  );
  // Lo sblocco da CLI azzera il conteggio dell'account: conta solo ciò che viene dopo.
  const afterUnblock = sql`${schema.auditLog.occurredAt} > coalesce((select max(occurred_at) from audit_log where action = ${AUTH_ACTIONS.loginUnblocked} and entity_id = ${digest}), '-infinity'::timestamptz)`;

  const [perAccount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auditLog)
    .where(
      and(
        failed,
        eq(schema.auditLog.entityType, IDENTIFIER_ENTITY),
        eq(schema.auditLog.entityId, digest),
        afterUnblock,
      ),
    );

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

/** Sblocco di un account da CLI: una riga di registro dopo la quale il conteggio riparte da zero; ritorna i fallimenti azzerati. */
export async function unblockAccount(
  db: Database,
  config: Config,
  identifier: string,
): Promise<number> {
  const digest = identifierDigest(identifier, config.IP_HASH_SALT);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.entityType, IDENTIFIER_ENTITY),
        eq(schema.auditLog.entityId, digest),
        eq(schema.auditLog.outcome, 'failure'),
        gte(
          schema.auditLog.occurredAt,
          new Date(Date.now() - config.LOGIN_WINDOW_MINUTES * 60_000),
        ),
        sql`coalesce(${schema.auditLog.detail}->>'reason', '') <> 'too_many_attempts'`,
      ),
    );
  await writeAudit(db, {
    action: AUTH_ACTIONS.loginUnblocked,
    entityType: IDENTIFIER_ENTITY,
    entityId: digest,
    detail: { source: 'cli' },
  });
  return row?.count ?? 0;
}
