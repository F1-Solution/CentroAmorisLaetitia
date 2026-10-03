/**
 * Scrittura in `import_runs` — la **connessione di registro** di
 * `IMPORTER-DESIGN.md` §5.3: in autocommit, mai dentro la transazione di una
 * fase. In modo `plan` non si scrive nulla qui (§5.2): il chiamante decide se
 * invocare queste funzioni.
 */
import type { Database } from '@amoris/db';
import { databaseNow, schema } from '@amoris/db';
import { eq, isNull } from 'drizzle-orm';
import type { ImportReport } from '../report/types.js';
import type { Tx } from './tx.js';

export interface CreateRunOptions {
  readonly isDryRun: boolean;
  readonly sourceLabel: string;
  readonly importerVersion: string;
}

export async function createRun(db: Database, options: CreateRunOptions): Promise<string> {
  const [row] = await db
    .insert(schema.importRuns)
    .values({
      isDryRun: options.isDryRun,
      sourceLabel: options.sourceLabel,
      importerVersion: options.importerVersion,
    })
    .returning({ id: schema.importRuns.id });
  if (!row) throw new Error('inserimento di import_runs non ha restituito una riga');
  return row.id;
}

/** `Tx` è ammesso solo perché una prova possa fissare l'ora della transazione. */
export async function finishRun(
  db: Database | Tx,
  runId: string,
  outcome: ImportReport['outcome'],
  summary: ImportReport,
): Promise<void> {
  await db
    .update(schema.importRuns)
    .set({
      // DR-090, DR-091: lo stesso orologio delle righe con cui si confronta.
      finishedAt: databaseNow(),
      outcome,
      summary: summary as unknown as Record<string, unknown>,
    })
    .where(eq(schema.importRuns.id, runId));
}

export async function listOpenRuns(db: Database): Promise<readonly { id: string }[]> {
  return db
    .select({ id: schema.importRuns.id })
    .from(schema.importRuns)
    .where(isNull(schema.importRuns.finishedAt));
}

export async function getRun(
  db: Database,
  runId: string,
): Promise<{ id: string; summary: unknown } | null> {
  const [row] = await db
    .select({ id: schema.importRuns.id, summary: schema.importRuns.summary })
    .from(schema.importRuns)
    .where(eq(schema.importRuns.id, runId));
  return row ?? null;
}
