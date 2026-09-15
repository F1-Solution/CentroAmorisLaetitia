import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { documentsStage } from '../../../src/stages/documents/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, { isDryRun: false, sourceLabel: 'BackupDB-2026-09-13', importerVersion: '0.0.0-test' });
}

const OPTIONS = { only: null, forceContentIds: [] as readonly string[], verbose: false };

const DOC_IDS = { public1: 959, public2: 960, public3: 961, public4: 962, private1: 935, private2: 937, private3: 941, private4: 943 };

function documentPost(id: number, postType: 'wpdmpro' | 'cuar_private_file', slug: string): SqlRow {
  return { ID: id, post_type: postType, post_title: `Documento ${id}`, post_name: slug, post_status: 'publish' };
}

const WP_POSTS: readonly SqlRow[] = [
  documentPost(DOC_IDS.public1, 'wpdmpro', 'modulo-1'),
  documentPost(DOC_IDS.public2, 'wpdmpro', 'modulo-2'),
  documentPost(DOC_IDS.public3, 'wpdmpro', 'modulo-3'),
  documentPost(DOC_IDS.public4, 'wpdmpro', 'modulo-4'),
  documentPost(DOC_IDS.private1, 'cuar_private_file', 'riservato-1'),
  documentPost(DOC_IDS.private2, 'cuar_private_file', 'riservato-2'),
  documentPost(DOC_IDS.private3, 'cuar_private_file', 'riservato-3'),
  documentPost(DOC_IDS.private4, 'cuar_private_file', 'riservato-4'),
];

function buildSource(extraMeta: readonly SqlRow[] = [], extraPosts: readonly SqlRow[] = []) {
  return fakeSourceReader({
    wp_posts: [...WP_POSTS, ...extraPosts],
    wp_postmeta: extraMeta,
    wp_term_relationships: [],
    wp_term_taxonomy: [],
  });
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_documents');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase documents', () => {
  it('i 4 documenti riservati (e, misurato, anche i 4 pubblici) producono l’avviso di collegamento non risolto, con codice riconoscibile, e non scrivono alcuna riga', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(documentsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(8);
    expect(result.errors).toBe(0);

    const rows = await testDb.db.select().from(schema.documents);
    expect(rows).toHaveLength(0);

    const unresolved = issues.collected.filter((i) => i.code === 'document-file-unresolved');
    expect(unresolved).toHaveLength(8);

    const privateDetails = unresolved.filter((i) =>
      [DOC_IDS.private1, DOC_IDS.private2, DOC_IDS.private3, DOC_IDS.private4].includes(i.sourceId),
    );
    expect(privateDetails).toHaveLength(4);
    expect(privateDetails.every((i) => i.detail === 'private-customer-area-storage-unreached')).toBe(true);

    const publicDetails = unresolved.filter((i) =>
      [DOC_IDS.public1, DOC_IDS.public2, DOC_IDS.public3, DOC_IDS.public4].includes(i.sourceId),
    );
    expect(publicDetails).toHaveLength(4);
    expect(publicDetails.every((i) => i.detail === 'download-manager-files-excluded')).toBe(true);
  });

  it('quando il file è risolvibile (`import_id_map` già popolato: il punto d’innesto del secondo lettore) scrive la riga, con le tassonomie risolvibili', async () => {
    const fresh = await createTestDatabase('amoris_importer_documents_resolved');
    try {
      const [media] = await fresh.db
        .insert(schema.media)
        .values({
          storageKey: 'documenti/modulo-1.pdf',
          publicPath: '/media/documenti/modulo-1.pdf',
          fileName: 'modulo-1.pdf',
          mimeType: 'application/pdf',
          byteSize: 1,
          checksum: Buffer.from('00', 'hex'),
          isPrivate: false,
          uploadedAt: new Date(),
        })
        .returning({ id: schema.media.id });
      await fresh.db.insert(schema.importIdMap).values({
        sourceTable: 'wp_posts',
        sourceId: DOC_IDS.public1,
        entity: 'media',
        entityId: media!.id,
      });

      const [term] = await fresh.db
        .insert(schema.terms)
        .values({ taxonomy: 'category', slug: 'moduli', name: 'Moduli', path: '/category/moduli/', legacyId: 30 })
        .returning({ id: schema.terms.id });
      await fresh.db.insert(schema.importIdMap).values({
        sourceTable: 'wp_terms',
        sourceId: 30,
        entity: 'term',
        entityId: term!.id,
      });

      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(documentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: fakeSourceReader({
          wp_posts: [documentPost(DOC_IDS.public1, 'wpdmpro', 'modulo-1')],
          wp_postmeta: [],
          wp_term_relationships: [{ object_id: DOC_IDS.public1, term_taxonomy_id: 1, term_order: 0 }],
          wp_term_taxonomy: [{ term_taxonomy_id: 1, term_id: 30, taxonomy: 'category', description: '', parent: 0, count: 1 }],
        }),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);

      const rows = await fresh.db.select().from(schema.documents);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.isPrivate).toBe(false);
      expect(rows[0]?.mediaId).toBe(media!.id);

      const docTerms = await fresh.db.select().from(schema.documentTerms);
      expect(docTerms).toHaveLength(1);
      expect(docTerms[0]?.termId).toBe(term!.id);
    } finally {
      await fresh.teardown();
    }
  });

  it('un elemento sintetico corrotto (percorso già occupato da un altro documento con lo stesso slug) produce un errore e non ferma la fase', async () => {
    const fresh = await createTestDatabase('amoris_importer_documents_isolation');
    try {
      const [media1] = await fresh.db
        .insert(schema.media)
        .values({
          storageKey: 'documenti/a.pdf',
          publicPath: '/media/documenti/a.pdf',
          fileName: 'a.pdf',
          mimeType: 'application/pdf',
          byteSize: 1,
          checksum: Buffer.from('00', 'hex'),
          isPrivate: false,
          uploadedAt: new Date(),
        })
        .returning({ id: schema.media.id });
      const [media2] = await fresh.db
        .insert(schema.media)
        .values({
          storageKey: 'documenti/b.pdf',
          publicPath: '/media/documenti/b.pdf',
          fileName: 'b.pdf',
          mimeType: 'application/pdf',
          byteSize: 1,
          checksum: Buffer.from('01', 'hex'),
          isPrivate: false,
          uploadedAt: new Date(),
        })
        .returning({ id: schema.media.id });

      const idA = 970;
      const idB = 971;
      await fresh.db.insert(schema.importIdMap).values([
        { sourceTable: 'wp_posts', sourceId: idA, entity: 'media', entityId: media1!.id },
        { sourceTable: 'wp_posts', sourceId: idB, entity: 'media', entityId: media2!.id },
      ]);
      // Stesso slug: `documents_slug_unique` fa fallire il secondo.
      await fresh.db.insert(schema.documents).values({ slug: 'duplicato', title: 'Occupante', mediaId: media1!.id });

      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(documentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: fakeSourceReader({
          wp_posts: [documentPost(idB, 'wpdmpro', 'duplicato')],
          wp_postmeta: [],
          wp_term_relationships: [],
          wp_term_taxonomy: [],
        }),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.errors).toBe(1);
      const failure = issues.collected.find((i) => i.code === 'item-import-failed');
      expect(failure).toBeDefined();
      expect(failure?.sourceId).toBe(idB);
    } finally {
      await fresh.teardown();
    }
  });

  it('rieseguita aggiorna sul posto, non duplica', async () => {
    const fresh = await createTestDatabase('amoris_importer_documents_idempotent');
    try {
      const [media] = await fresh.db
        .insert(schema.media)
        .values({
          storageKey: 'documenti/c.pdf',
          publicPath: '/media/documenti/c.pdf',
          fileName: 'c.pdf',
          mimeType: 'application/pdf',
          byteSize: 1,
          checksum: Buffer.from('02', 'hex'),
          isPrivate: false,
          uploadedAt: new Date(),
        })
        .returning({ id: schema.media.id });
      const legacyId = 980;
      await fresh.db.insert(schema.importIdMap).values({
        sourceTable: 'wp_posts',
        sourceId: legacyId,
        entity: 'media',
        entityId: media!.id,
      });

      const source = fakeSourceReader({
        wp_posts: [documentPost(legacyId, 'wpdmpro', 'rieseguito')],
        wp_postmeta: [],
        wp_term_relationships: [],
        wp_term_taxonomy: [],
      });

      const runId1 = await newApplyRunId(fresh.db);
      await runStage(documentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source,
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId1),
        options: OPTIONS,
      });

      const runId2 = await newApplyRunId(fresh.db);
      const result = await runStage(documentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source,
        runId: runId2,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId2),
        options: OPTIONS,
      });

      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
      const rows = await fresh.db.select().from(schema.documents);
      expect(rows).toHaveLength(1);

      const idMapRows = await fresh.db.select().from(schema.importIdMap).where(eq(schema.importIdMap.entity, 'document'));
      expect(idMapRows).toHaveLength(1);
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_documents_plan');
    try {
      const runId = randomUUID();
      const issues = createIssueSink(fresh.db, 'plan', runId);
      const result = await runStage(documentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId,
        mode: 'plan',
        issues,
        options: OPTIONS,
      });

      expect(result.skipped).toBe(8);
      const rows = await fresh.db.select().from(schema.documents);
      expect(rows).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });
});
