import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { forEachItem } from '../../../src/persistence/forEachItem.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_foreachitem');
});

afterAll(async () => {
  await testDb.teardown();
});

/**
 * `IMPORTER-DESIGN.md` §4.2: l'errore su un elemento non interrompe la fase e
 * non lascia tracce del solo elemento fallito, mentre gli altri restano.
 */
describe('forEachItem — isolamento per elemento', () => {
  it('un elemento che fallisce non tocca gli altri, e la transazione resta viva', async () => {
    const items = [
      { key: 'prova.uno', shouldFail: false },
      { key: 'prova.due', shouldFail: true },
      { key: 'prova.tre', shouldFail: false },
    ];
    const errors: { sourceTable: string; sourceId: number }[] = [];

    await testDb.db.transaction(async (tx) => {
      const result = await forEachItem(
        tx,
        items,
        (item) => ({ sourceTable: 'prova', sourceId: items.indexOf(item) }),
        async (item, itemTx) => {
          if (item.shouldFail) throw new Error('fallimento deliberato');
          await itemTx
            .insert(schema.settings)
            .values({ key: item.key, value: 'x', label: item.key })
            .onConflictDoNothing();
          return 'created';
        },
        async (key) => {
          errors.push(key);
        },
      );

      expect(result.created).toBe(2);
      expect(result.errors).toBe(1);

      // Dentro la stessa transazione, la connessione è ancora utilizzabile:
      // non è stata resa inutilizzabile dall'errore del secondo elemento.
      await tx.select().from(schema.settings);
    });

    const rows = await testDb.db.select().from(schema.settings);
    expect(rows.map((r) => r.key).sort()).toEqual(['prova.tre', 'prova.uno']);
    expect(errors).toEqual([{ sourceTable: 'prova', sourceId: 1 }]);

    await testDb.db.delete(schema.settings).where(eq(schema.settings.key, 'prova.uno'));
    await testDb.db.delete(schema.settings).where(eq(schema.settings.key, 'prova.tre'));
  });
});
