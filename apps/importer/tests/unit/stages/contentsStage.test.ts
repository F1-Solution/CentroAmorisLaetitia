import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { blockDocumentSchema } from '@amoris/blocks/model';
import type { Database } from '@amoris/db';
import { contentsStage } from '../../../src/stages/contents/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun, finishRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, { isDryRun: false, sourceLabel: 'BackupDB-2026-09-13', importerVersion: '0.0.0-test' });
}

const OPTIONS = { only: null, forceContentIds: [] as readonly string[], verbose: false };

const BASE_POSTS: readonly SqlRow[] = [
  {
    ID: 100,
    post_author: 1,
    post_title: 'Chi siamo',
    post_content: '<p>Un testo di prova.</p>',
    post_excerpt: '',
    post_status: 'publish',
    post_name: 'chi-siamo',
    post_type: 'page',
    post_date: '2020-01-10 09:00:00',
    post_parent: 0,
    menu_order: 0,
  },
  {
    ID: 101,
    post_author: 1,
    post_title: 'Un articolo',
    post_content: '<p>Corpo dell’articolo.</p>',
    post_excerpt: 'Estratto',
    post_status: 'publish',
    post_name: 'un-articolo',
    post_type: 'post',
    post_date: '2020-02-20 09:00:00',
    post_parent: 0,
    menu_order: 0,
  },
  {
    ID: 102,
    post_author: 1,
    post_title: '',
    post_content: '',
    post_excerpt: '',
    post_status: 'auto-draft',
    post_name: '',
    post_type: 'post',
    post_date: '2020-02-20 09:00:00',
    post_parent: 0,
    menu_order: 0,
  },
  {
    ID: 103,
    post_author: 1,
    post_title: 'Revisione di Chi siamo',
    post_content: '<p>Vecchia versione.</p>',
    post_excerpt: '',
    post_status: 'inherit',
    post_name: '100-revision-v1',
    post_type: 'revision',
    post_date: '2020-01-10 09:00:00',
    post_parent: 100,
    menu_order: 0,
  },
];

function buildContentsSource(posts: readonly SqlRow[] = BASE_POSTS, postmeta: readonly SqlRow[] = [], options: readonly SqlRow[] = []) {
  return fakeSourceReader({ wp_posts: posts, wp_postmeta: postmeta, wp_options: options });
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_contents');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase contents', () => {
  it('importa pagine e articoli pubblicati, scarta auto-draft e revision', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(contentsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildContentsSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(2); // chi-siamo, un-articolo — non l'auto-draft, non la revision
    expect(result.errors).toBe(0);

    const rows = await testDb.db.select().from(schema.contents);
    expect(rows).toHaveLength(2);

    const page = rows.find((r) => r.slug === 'chi-siamo');
    expect(page?.type).toBe('page');
    expect(page?.status).toBe('published');
    expect(page?.legacyId).toBe(100);
    expect(page?.legacyFormat).toBe('html');
    expect(page?.contentHtml).toContain('blk-text');
    expect(page?.contentText).toContain('Un testo di prova.');
    expect(page?.publishedAt).not.toBeNull();

    const post = rows.find((r) => r.slug === 'un-articolo');
    expect(post?.type).toBe('post');
    expect(post?.excerpt).toBe('Estratto');

    // Ogni blocco prodotto convalida contro il proprio schema (BLOCK-MODEL.md §1).
    expect(() => blockDocumentSchema.parse(page?.blocks)).not.toThrow();
    expect(() => blockDocumentSchema.parse(post?.blocks)).not.toThrow();

    const idMapRows = await testDb.db
      .select()
      .from(schema.importIdMap)
      .where(eq(schema.importIdMap.entity, 'content'));
    expect(idMapRows).toHaveLength(2);
  });

  it('il percorso provvisorio include legacyId (due contenuti possono condividere lo slug fra tipi diversi): relations lo sostituirà', async () => {
    const rows = await testDb.db.select().from(schema.contents);
    const page = rows.find((r) => r.slug === 'chi-siamo');
    expect(page?.path).toBe('/chi-siamo-100/');
    expect(page?.parentId).toBeNull();
  });

  it('rieseguita aggiorna sul posto, non duplica', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const before = await testDb.db.select().from(schema.contents);

    const result = await runStage(contentsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildContentsSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(2);

    const after = await testDb.db.select().from(schema.contents);
    expect(after).toHaveLength(2);
    expect(new Set(after.map((r) => r.id))).toEqual(new Set(before.map((r) => r.id)));
  });

  it('un elemento sintetico corrotto (percorso provvisorio già occupato) produce un errore isolato', async () => {
    const fresh = await createTestDatabase('amoris_importer_contents_isolation');
    try {
      const brokenPosts: SqlRow[] = [
        ...BASE_POSTS.slice(0, 1),
        {
          ID: 200,
          post_author: 1,
          post_title: 'Pagina rotta',
          post_content: '<p>Testo qualunque.</p>',
          post_excerpt: '',
          post_status: 'publish',
          post_name: 'pagina-rotta',
          post_type: 'page',
          post_date: '2020-01-10 09:00:00',
          post_parent: 0,
          menu_order: 0,
        },
      ];

      // Un'altra riga occupa già il percorso provvisorio `/pagina-rotta-200/`
      // (slug + legacyId, `contents/index.ts` `provisionalPath`):
      // l'inserimento di questo contenuto violerà il vincolo di unicità su
      // `path` — lo stesso genere di anomalia sintetica usato in
      // `mediaStage.test.ts`.
      await fresh.db.insert(schema.contents).values({
        type: 'page',
        status: 'draft',
        slug: 'altro-slug',
        path: '/pagina-rotta-200/',
        title: 'Occupante',
        legacyId: 999999,
      });

      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildContentsSource(brokenPosts),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(1); // chi-siamo, comunque creato
      expect(result.errors).toBe(1); // pagina-rotta, in conflitto sul percorso
      const rows = await fresh.db.select().from(schema.contents);
      expect(rows.some((r) => r.slug === 'pagina-rotta')).toBe(false);

      const failure = issues.collected.find((i) => i.code === 'item-import-failed');
      expect(failure).toBeDefined();
      expect(failure?.sourceId).toBe(200);
    } finally {
      await fresh.teardown();
    }
  });

  it('la protezione del lavoro redazionale: non sovrascrive un contenuto modificato dopo l’ultima esecuzione riuscita', async () => {
    const fresh = await createTestDatabase('amoris_importer_contents_editorial');
    try {
      const firstPosts: SqlRow[] = [BASE_POSTS[0]!];
      const runId1 = await newApplyRunId(fresh.db);
      await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildContentsSource(firstPosts),
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId1),
        options: OPTIONS,
      });
      await finishRun(fresh.db, runId1, 'success', {
        runId: runId1,
        mode: 'apply',
        importerVersion: '0.0.0-test',
        sourceLabel: 'BackupDB-2026-09-13',
        stages: [],
        conversion: {
          gutenberg: 0,
          divi: 0,
          html: 1,
          blocksTotal: 1,
          blocksNonContainer: 1,
          fallbackBlocks: 0,
          fallbackPercent: 0,
          fallbackByReason: { 'unknown-shortcode': 0, 'unknown-attribute': 0, 'unclassified-html': 0 },
          contentsWithFallback: 0,
          thresholdPercentOk: true,
          thresholdContentsOk: true,
        },
        checks: [],
        skippedForEditorialWork: [],
        issues: [],
        outcome: 'success',
      });

      const [imported] = await fresh.db
        .select({ id: schema.contents.id })
        .from(schema.contents)
        .where(eq(schema.contents.slug, 'chi-siamo'));
      expect(imported).toBeDefined();

      // Un salvataggio redazionale **sintetico**, successivo alla fine
      // dell'esecuzione: il CMS non esiste ancora, quindi la riga di
      // cronologia va inserita direttamente dal test
      // (`IMPORTER-DESIGN.md` §11.2).
      await new Promise((resolve) => setTimeout(resolve, 20));
      await fresh.db.insert(schema.contentRevisions).values({
        contentId: imported!.id,
        revisionNo: 1,
        title: 'Chi siamo, modificato a mano',
        blocks: { schema: 1, blocks: [] },
      });

      const runId2 = await newApplyRunId(fresh.db);
      const issues2 = createIssueSink(fresh.db, 'apply', runId2);
      const result2 = await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildContentsSource(firstPosts),
        runId: runId2,
        mode: 'apply',
        issues: issues2,
        options: OPTIONS,
      });

      expect(result2.skipped).toBe(1);
      expect(result2.updated).toBe(0);

      const protectionIssue = issues2.collected.find((i) => i.code === 'editorial-work-protected');
      expect(protectionIssue).toBeDefined();
      expect(protectionIssue?.sourceId).toBe(100);

      const [stillOriginal] = await fresh.db
        .select({ title: schema.contents.title })
        .from(schema.contents)
        .where(eq(schema.contents.id, imported!.id));
      expect(stillOriginal?.title).toBe('Chi siamo'); // non sovrascritto dalla sorgente

      // `--force-content <id>` sovrascrive comunque.
      const runId3 = await newApplyRunId(fresh.db);
      const result3 = await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildContentsSource(firstPosts),
        runId: runId3,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId3),
        options: { only: null, forceContentIds: [imported!.id], verbose: false },
      });
      expect(result3.updated).toBe(1);
      expect(result3.skipped).toBe(0);
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_contents_plan');
    try {
      const runId = randomUUID();
      const issues = createIssueSink(fresh.db, 'plan', runId);
      const result = await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildContentsSource(),
        runId,
        mode: 'plan',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(2);

      const rows = await fresh.db.select().from(schema.contents);
      expect(rows).toHaveLength(0);
      const idMapRows = await fresh.db.select().from(schema.importIdMap);
      expect(idMapRows).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });
});
