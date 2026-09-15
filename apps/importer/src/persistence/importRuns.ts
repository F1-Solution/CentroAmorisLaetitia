/**
 * Scrittura in `import_runs` — la **connessione di registro** di
 * `IMPORTER-DESIGN.md` §5.3: in autocommit, mai dentro la transazione di una
 * fase. In modo `plan` non si scrive nulla qui (§5.2): il chiamante decide se
 * invocare queste funzioni.
 */
import type { Database } from '@amoris/db';
import { schema } from '@amoris/db';
import { eq, isNull } from 'drizzle-orm';
import type { ImportReport } from '../report/types.js';

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

export async function finishRun(
  db: Database,
  runId: string,
  outcome: ImportReport['outcome'],
  summary: ImportReport,
): Promise<void> {
  await db
    .update(schema.importRuns)
    .set({ finishedAt: new Date(), outcome, summary: summary as unknown as Record<string, unknown> })
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
