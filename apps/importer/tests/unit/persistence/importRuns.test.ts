import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { createRun, finishRun } from '../../../src/persistence/importRuns.js';
import type { ImportReport } from '../../../src/report/types.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_import_runs');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('finishRun', () => {
  it('DR-090, DR-091: registra la fine con l’ora del database, non con quella di Node', async () => {
    const runId = await createRun(testDb.db, {
      isDryRun: false,
      sourceLabel: 'BackupDB-2026-09-13',
      importerVersion: '0.0.0-test',
    });
    // Il rapporto è solo archiviato: qui conta l'ora, non il contenuto.
    const summary = { runId } as unknown as ImportReport;

    // In una transazione `now()` resta fermo all'inizio: con l'ora del database
    // la fine coincide con quell'istante anche dopo l'attesa, con quella di Node no.
    await testDb.db.transaction(async (tx) => {
      const [start] = await tx
        .select({ at: sql<string>`date_trunc('milliseconds', now())::text` })
        .from(schema.importRuns)
        .where(eq(schema.importRuns.id, runId));
      await new Promise((resolve) => setTimeout(resolve, 50));
      await finishRun(tx, runId, 'success', summary);
      const [row] = await tx
        .select({ at: sql<string>`finished_at::text` })
        .from(schema.importRuns)
        .where(eq(schema.importRuns.id, runId));
      expect(row!.at).toBe(start!.at);
    });
  });
});
