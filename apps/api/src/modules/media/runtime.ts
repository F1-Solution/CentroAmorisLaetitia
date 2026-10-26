import { mediaMessages } from '@amoris/contracts';
import type { Database } from '@amoris/db';
import { sql } from 'drizzle-orm';
import type { Config } from '../../config.js';
import type { Transaction } from './fileName.js';
import { mediaError } from './fileType.js';
import { createGate, type ProcessingGate } from './gate.js';

/** Semaforo dell'elaborazione e attesa massima dei blocchi, uguali per ogni richiesta del processo. */
export interface MediaRuntime {
  readonly gate: ProcessingGate;
  readonly lockTimeoutMs: number;
}

export const DEFAULT_LOCK_TIMEOUT_MS = 10_000;

export function createMediaRuntime(config: Config): MediaRuntime {
  return {
    gate: createGate(config.MEDIA_MAX_CONCURRENT, config.MEDIA_QUEUE_LENGTH),
    lockTimeoutMs: config.MEDIA_LOCK_TIMEOUT_MS,
  };
}

/** Codice PostgreSQL di `lock_not_available`, anche se il driver lo annida in `cause`. */
function isLockTimeout(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && typeof current === 'object' && current !== null; depth += 1) {
    if ((current as { code?: unknown }).code === '55P03') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Transazione con attesa massima dei blocchi: oltre, 503 `MEDIA_BUSY` in italiano. */
export async function inMediaTransaction<T>(
  db: Database,
  runtime: Pick<MediaRuntime, 'lockTimeoutMs'> | undefined,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const timeout = runtime?.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('lock_timeout', ${`${timeout}ms`}, true)`);
      return work(tx);
    });
  } catch (error) {
    if (isLockTimeout(error)) throw mediaError('MEDIA_BUSY', mediaMessages.busy());
    throw error;
  }
}
