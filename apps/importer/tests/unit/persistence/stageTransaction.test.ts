import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@amoris/db';
import { runStageTransaction } from '../../../src/persistence/stageTransaction.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_stagetx');
});

afterAll(async () => {
  await testDb.teardown();
});

/**
 * `IMPORTER-DESIGN.md` §4.3, §5.2: la transazione di una fase va a `COMMIT`
 * in `apply` quando non fallisce; annullata **sempre** in `plan`, anche se
 * tutto è andato bene; annullata per intero in `apply` se la fase solleva un
 * errore strutturale — provato annullandola di proposito.
 */
describe('runStageTransaction', () => {
  it('apply: COMMIT quando la fase non fallisce', async () => {
    await runStageTransaction(testDb.db, 'apply', async (tx) => {
      await tx.insert(schema.settings).values({ key: 'tx.commit', value: 1, label: 'prova' });
    });
    const rows = await testDb.db.select().from(schema.settings);
    expect(rows.some((r) => r.key === 'tx.commit')).toBe(true);
  });

  it('apply: ROLLBACK per intero se la fase solleva un errore strutturale', async () => {
    await expect(
      runStageTransaction(testDb.db, 'apply', async (tx) => {
        await tx.insert(schema.settings).values({ key: 'tx.rollback', value: 1, label: 'prova' });
        throw new Error('errore strutturale deliberato');
      }),
    ).rejects.toThrow('errore strutturale deliberato');

    const rows = await testDb.db.select().from(schema.settings);
    expect(rows.some((r) => r.key === 'tx.rollback')).toBe(false);
  });

  it('plan: scrive per davvero dentro la transazione, poi la annulla sempre', async () => {
    const result = await runStageTransaction(testDb.db, 'plan', async (tx) => {
      await tx.insert(schema.settings).values({ key: 'tx.plan', value: 1, label: 'prova' });
      const seenInsideTx = await tx.select().from(schema.settings);
      return seenInsideTx.some((r) => r.key === 'tx.plan');
    });

    // Dentro la transazione la scrittura era visibile: non è una simulazione.
    expect(result).toBe(true);

    // Dopo, annullata: non resta nulla.
    const rows = await testDb.db.select().from(schema.settings);
    expect(rows.some((r) => r.key === 'tx.plan')).toBe(false);
  });
});
