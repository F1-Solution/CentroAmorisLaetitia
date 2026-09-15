/**
 * `import_id_map.action` (DR-059): la colonna nuova si scrive davvero, e
 * distingue una creazione da un aggiornamento su una riesecuzione — non solo
 * accettata dall'interfaccia e scartata, come prima della decisione.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { createIdMap } from '../../../src/persistence/idMap.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_idmap');
});

afterAll(async () => {
  await testDb.teardown();
});

async function readAction(db: Database, sourceId: number): Promise<string | undefined> {
  const [row] = await db
    .select({ action: schema.importIdMap.action })
    .from(schema.importIdMap)
    .where(eq(schema.importIdMap.sourceId, sourceId));
  return row?.action;
}

describe('IdMap.remember — colonna action (DR-059)', () => {
  it('persiste `created` alla prima registrazione', async () => {
    const idMap = createIdMap();
    const entityId = crypto.randomUUID();
    await testDb.db.transaction(async (tx) => {
      await idMap.remember(tx, 'wp_terms', 501, 'term', entityId, null, 'created');
    });

    expect(await readAction(testDb.db, 501)).toBe('created');
  });

  it('una riesecuzione con `updated` sovrascrive l’azione, non ne aggiunge una riga', async () => {
    const idMap = createIdMap();
    const entityId = crypto.randomUUID();
    await testDb.db.transaction(async (tx) => {
      await idMap.remember(tx, 'wp_terms', 502, 'term', entityId, null, 'created');
    });
    expect(await readAction(testDb.db, 502)).toBe('created');

    // Seconda esecuzione sulla stessa riga: l'entità esisteva già, quindi
    // questa volta l'azione è `updated`.
    await testDb.db.transaction(async (tx) => {
      await idMap.remember(tx, 'wp_terms', 502, 'term', entityId, null, 'updated');
    });
    expect(await readAction(testDb.db, 502)).toBe('updated');

    const rows = await testDb.db
      .select()
      .from(schema.importIdMap)
      .where(eq(schema.importIdMap.sourceId, 502));
    expect(rows).toHaveLength(1);
  });
});
