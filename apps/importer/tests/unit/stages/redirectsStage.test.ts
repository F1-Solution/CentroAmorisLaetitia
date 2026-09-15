import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { redirectsStage } from '../../../src/stages/redirects/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createIdMap } from '../../../src/persistence/idMap.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

const OPTIONS = { only: null, forceContentIds: [] as readonly string[], verbose: false };

/**
 * Dati sintetici (DR-010): un contenuto già "risolto" (come lo lascerebbe
 * `relations`), un allegato risolvibile e uno no (`_wp_attached_file`
 * mancante, come l'allegato reale non recuperabile di `IMPORTER-DESIGN.md`
 * §11.7), un documento `wpdmpro`, e tre righe `_wp_old_slug`: una risolvibile,
 * una che punta a un contenuto inesistente (come il `wpforms` reale), una che
 * produrrebbe un anello (lo slug "storico" è lo slug attuale).
 */
const POSTS: readonly SqlRow[] = [
  {
    ID: 600,
    post_type: 'attachment',
    post_name: 'foto',
    post_parent: 500,
    post_status: 'inherit',
  },
  {
    ID: 601,
    post_type: 'attachment',
    post_name: 'foto-perduta',
    post_parent: 0,
    post_status: 'inherit',
  },
];

const POSTMETA: readonly SqlRow[] = [
  { meta_id: 1, post_id: 500, meta_key: '_wp_old_slug', meta_value: 'vecchio-slug' },
  { meta_id: 2, post_id: 999, meta_key: '_wp_old_slug', meta_value: 'slug-di-un-wpforms' },
  { meta_id: 3, post_id: 500, meta_key: '_wp_old_slug', meta_value: 'genitore' },
];

function buildSource() {
  return fakeSourceReader({ wp_posts: POSTS, wp_postmeta: POSTMETA });
}

async function seedContentAndMedia(db: Database): Promise<{ mediaId: string }> {
  await db.insert(schema.contents).values({
    type: 'page',
    status: 'published',
    slug: 'genitore',
    path: '/genitore/',
    title: 'Genitore',
    legacyId: 500,
    publishedAt: new Date(),
  });

  const [media] = await db
    .insert(schema.media)
    .values({
      storageKey: '2020/05/foto.jpg',
      publicPath: '/media/2020/05/foto.jpg',
      fileName: 'foto.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1,
      checksum: Buffer.from('00', 'hex'),
      isPrivate: false,
      uploadedAt: new Date(),
      legacyId: 600,
    })
    .returning({ id: schema.media.id });

  const [documentMedia] = await db
    .insert(schema.media)
    .values({
      storageKey: 'download-manager-files/modulo-test.pdf',
      publicPath: '/media/download-manager-files/modulo-test.pdf',
      fileName: 'modulo-test.pdf',
      mimeType: 'application/pdf',
      byteSize: 1,
      checksum: Buffer.from('01', 'hex'),
      isPrivate: false,
      uploadedAt: new Date(),
      legacyId: 700,
    })
    .returning({ id: schema.media.id });

  await db.insert(schema.documents).values({
    slug: 'modulo-test',
    title: 'Modulo di prova',
    mediaId: documentMedia!.id,
    isPrivate: false,
    legacyId: 700,
    legacySource: 'wpdmpro',
  });

  return { mediaId: media!.id };
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_redirects');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase redirects', () => {
  it('produce le quattro famiglie, scarta anelli e destinazioni non risolte', async () => {
    await seedContentAndMedia(testDb.db);

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(redirectsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.errors).toBe(0);
    // pagina allegato risolta + documento + prefisso + slug storico risolto
    expect(result.created).toBe(4);
    // allegato senza media, slug di un `wpforms`, slug che è un anello
    expect(result.skipped).toBe(3);

    const rows = await testDb.db.select().from(schema.redirects);
    const bySource = new Map(rows.map((r) => [r.sourcePath, r]));

    expect(bySource.get('/genitore/foto/')?.targetPath).toBe('/media/2020/05/foto.jpg');
    expect(bySource.get('/genitore/foto/')?.origin).toBe('migration');
    expect(bySource.get('/genitore/foto/')?.kind).toBe('exact');

    expect(bySource.get('/modulo-test/')?.targetPath).toBe('/download/modulo-test/');

    expect(bySource.get('/wp-content/uploads/')?.targetPath).toBe('/media/');
    expect(bySource.get('/wp-content/uploads/')?.kind).toBe('prefix');

    expect(bySource.get('/vecchio-slug/')?.targetPath).toBe('/genitore/');

    // nessuna riga per l'allegato perduto, il wpforms, o l'anello
    expect(bySource.has('/foto-perduta/')).toBe(false);
    expect(rows.filter((r) => r.sourcePath === '/genitore/').length).toBe(0);

    const unresolved = issues.collected.filter((i) => i.code === 'redirect-unresolved-target');
    expect(unresolved).toHaveLength(2);
    const selfLoop = issues.collected.filter((i) => i.code === 'redirect-self-loop');
    expect(selfLoop).toHaveLength(1);

    const expectedCount = await testDb.db.transaction((tx) =>
      redirectsStage.expected({
        runId,
        mode: 'apply',
        source: buildSource(),
        tx,
        storage: fakeObjectStore(),
        ids: createIdMap(),
        issues,
        options: OPTIONS,
        ipHashSalt: null, // `redirects` non calcola digest
      }),
    );
    expect(expectedCount).toBe(4);
  });

  it('non tocca mai un redirect con origin = manual, anche se occupa il percorso calcolato', async () => {
    const fresh = await createTestDatabase('amoris_importer_redirects_manual');
    try {
      await seedContentAndMedia(fresh.db);
      await fresh.db.insert(schema.redirects).values({
        sourcePath: '/genitore/foto/',
        targetPath: '/altrove/',
        origin: 'manual',
        kind: 'exact',
      });

      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(redirectsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.errors).toBe(0);
      const row = (
        await fresh.db
          .select()
          .from(schema.redirects)
          .where(eq(schema.redirects.sourcePath, '/genitore/foto/'))
      )[0]!;
      expect(row.origin).toBe('manual');
      expect(row.targetPath).toBe('/altrove/');

      const protectedIssues = issues.collected.filter(
        (i) => i.code === 'redirect-protected-by-manual',
      );
      expect(protectedIssues).toHaveLength(1);
    } finally {
      await fresh.teardown();
    }
  });

  it('rieseguita ricalcola le righe origin=migration senza duplicarle', async () => {
    const fresh = await createTestDatabase('amoris_importer_redirects_idempotent');
    try {
      await seedContentAndMedia(fresh.db);

      const runId1 = await newApplyRunId(fresh.db);
      await runStage(redirectsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId1),
        options: OPTIONS,
      });
      const firstRun = await fresh.db.select().from(schema.redirects);

      const runId2 = await newApplyRunId(fresh.db);
      const result2 = await runStage(redirectsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: runId2,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId2),
        options: OPTIONS,
      });

      expect(result2.created).toBe(0);
      expect(result2.updated).toBe(4);
      const secondRun = await fresh.db.select().from(schema.redirects);
      expect(secondRun).toHaveLength(firstRun.length);
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla', async () => {
    const fresh = await createTestDatabase('amoris_importer_redirects_plan');
    try {
      await seedContentAndMedia(fresh.db);
      const before = await fresh.db.select().from(schema.redirects);

      const planRunId = randomUUID();
      await runStage(redirectsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: planRunId,
        mode: 'plan',
        issues: createIssueSink(fresh.db, 'plan', planRunId),
        options: OPTIONS,
      });

      const after = await fresh.db.select().from(schema.redirects);
      expect(after).toEqual(before);
    } finally {
      await fresh.teardown();
    }
  });
});
