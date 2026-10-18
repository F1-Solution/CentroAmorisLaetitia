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
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

const OPTIONS = { only: null, forceContentIds: [] as readonly string[], verbose: false };

/** Chiude un'esecuzione come riuscita: è l'ora di fine che la protezione redazionale legge. */
async function finishSuccessfulRun(db: Database, runId: string): Promise<void> {
  await finishRun(db, runId, 'success', {
    runId,
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
      fallbackByReason: {
        wp_html_block: 0,
        divi_unmapped_module: 0,
        divi_unmapped_markup: 0,
        shortcode_unknown: 0,
        manual: 0,
      },
      contentsWithFallback: 0,
      thresholdPercentOk: true,
      thresholdContentsOk: true,
    },
    checks: [],
    skippedForEditorialWork: [],
    issues: [],
    outcome: 'success',
  });
}

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

function buildContentsSource(
  posts: readonly SqlRow[] = BASE_POSTS,
  postmeta: readonly SqlRow[] = [],
  options: readonly SqlRow[] = [],
) {
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
      // (slug + legacyId, `relations/paths.ts` `provisionalPath`):
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
          fallbackByReason: {
            wp_html_block: 0,
            divi_unmapped_module: 0,
            divi_unmapped_markup: 0,
            shortcode_unknown: 0,
            manual: 0,
          },
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

  it('la protezione vale anche per la copia di lavoro (DR-068): una bozza salvata dopo l’ultima esecuzione riuscita non si perde', async () => {
    const fresh = await createTestDatabase('amoris_importer_contents_drafts');
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
      await finishSuccessfulRun(fresh.db, runId1);

      const [imported] = await fresh.db
        .select({ id: schema.contents.id, updatedAt: schema.contents.updatedAt })
        .from(schema.contents)
        .where(eq(schema.contents.slug, 'chi-siamo'));

      // Il salvataggio automatico dell'editor scrive solo la copia di lavoro,
      // mai `content_revisions`: la sola traccia del lavoro è la copia stessa.
      await new Promise((resolve) => setTimeout(resolve, 20));
      const [redattore] = await fresh.db
        .insert(schema.users)
        .values({ email: 'redattore@example.test', fullName: 'Redattore di prova' })
        .returning({ id: schema.users.id });
      await fresh.db.insert(schema.contentDrafts).values({
        contentId: imported!.id,
        authorId: redattore!.id,
        title: 'Chi siamo, bozza in corso',
        blocks: { schema: 1, blocks: [] },
        baseUpdatedAt: imported!.updatedAt,
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
      expect(result2.skippedForEditorialWork).toEqual([imported!.id]);
      const protectionIssue = issues2.collected.find((i) => i.code === 'editorial-work-protected');
      expect(protectionIssue?.sourceId).toBe(100);

      // Il contenuto non è stato toccato: la copia resta pubblicabile, perché
      // il servizio confronta `baseUpdatedAt` con `contents.updated_at`.
      const [untouched] = await fresh.db
        .select({ updatedAt: schema.contents.updatedAt })
        .from(schema.contents)
        .where(eq(schema.contents.id, imported!.id));
      expect(untouched?.updatedAt.getTime()).toBe(imported!.updatedAt.getTime());

      // Una copia **più vecchia** dell'ultima esecuzione riuscita non protegge.
      await finishSuccessfulRun(fresh.db, runId2);
      const runId3 = await newApplyRunId(fresh.db);
      const result3 = await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildContentsSource(firstPosts),
        runId: runId3,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId3),
        options: OPTIONS,
      });
      expect(result3.updated).toBe(1);
    } finally {
      await fresh.teardown();
    }
  });

  it('`--force-content` sovrascrive anche un contenuto protetto dalla copia di lavoro', async () => {
    const fresh = await createTestDatabase('amoris_importer_contents_drafts_force');
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
      await finishSuccessfulRun(fresh.db, runId1);

      const [imported] = await fresh.db
        .select({ id: schema.contents.id, updatedAt: schema.contents.updatedAt })
        .from(schema.contents)
        .where(eq(schema.contents.slug, 'chi-siamo'));
      await new Promise((resolve) => setTimeout(resolve, 20));
      const [redattore] = await fresh.db
        .insert(schema.users)
        .values({ email: 'redattore@example.test', fullName: 'Redattore di prova' })
        .returning({ id: schema.users.id });
      await fresh.db.insert(schema.contentDrafts).values({
        contentId: imported!.id,
        authorId: redattore!.id,
        title: 'Chi siamo, bozza in corso',
        blocks: { schema: 1, blocks: [] },
        baseUpdatedAt: imported!.updatedAt,
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
        options: { only: null, forceContentIds: [imported!.id], verbose: false },
      });
      expect(result2.updated).toBe(1);
      expect(result2.skipped).toBe(0);
      expect(issues2.collected.some((i) => i.code === 'editorial-work-protected')).toBe(false);
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

  it('description della sorgente e data di modifica (DR-180, DR-186), senza esporre le pagine riservate', async () => {
    const fresh = await createTestDatabase('amoris_importer_contents_description');
    try {
      const posts: SqlRow[] = [
        {
          ID: 200,
          post_author: 1,
          post_title: 'Pagina con apici',
          post_content: `<p>L'incontro "aperto"</p><p>di prova</p>`,
          post_excerpt: 'Estratto copiato da un’altra pagina',
          post_status: 'publish',
          post_name: 'pagina-con-apici',
          post_type: 'page',
          post_date: '2020-01-10 09:00:00',
          post_modified: '2021-03-04 11:12:13',
          post_modified_gmt: '2021-03-04 10:12:13',
          post_parent: 0,
          menu_order: 0,
        },
        {
          ID: 201,
          post_author: 1,
          post_title: 'Articolo con estratto',
          post_content: '<p>Corpo</p>',
          post_excerpt: `L'estratto "grezzo"`,
          post_status: 'publish',
          post_name: 'articolo-con-estratto',
          post_type: 'post',
          post_date: '2020-02-20 09:00:00',
          post_parent: 0,
          menu_order: 0,
        },
        {
          ID: 202,
          post_author: 1,
          post_title: 'Pagina riservata',
          post_content: '<p>Contenuto riservato sintetico</p>',
          post_excerpt: 'Estratto riservato sintetico',
          post_status: 'publish',
          post_name: 'pagina-riservata',
          post_type: 'page',
          post_date: '2020-02-20 09:00:00',
          post_parent: 0,
          menu_order: 0,
        },
        {
          ID: 203,
          post_author: 1,
          post_title: 'Pagina Divi vuota',
          post_content: '[et_pb_section][et_pb_text]Solo moduli[/et_pb_text][/et_pb_section]',
          post_excerpt: '',
          post_status: 'publish',
          post_name: 'pagina-divi-vuota',
          post_type: 'page',
          post_date: '2020-02-20 09:00:00',
          post_parent: 0,
          menu_order: 0,
        },
      ];
      const postmeta: SqlRow[] = [
        { meta_id: 1, post_id: 202, meta_key: '_members_access_role', meta_value: 'socio' },
      ];
      const runId = await newApplyRunId(fresh.db);
      await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildContentsSource(posts, postmeta),
        runId,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId),
        options: OPTIONS,
      });
      const rows = await fresh.db.select().from(schema.contents);
      const bySlug = (slug: string) => rows.find((r) => r.slug === slug);

      // Pagina: il testo grezzo, apici dritti e tag tolti senza spazi; il titolo resta tipografico.
      expect(bySlug('pagina-con-apici')?.descriptionSource).toBe(`L'incontro "aperto"di prova`);
      expect(bySlug('pagina-con-apici')?.modifiedAt?.toISOString()).toBe('2021-03-04T10:12:13.000Z');
      // Articolo: l'estratto grezzo, accanto a quello tipografico per gli elenchi.
      expect(bySlug('articolo-con-estratto')?.descriptionSource).toBe(`L'estratto "grezzo"`);
      expect(bySlug('articolo-con-estratto')?.excerpt).toBe('L’estratto “grezzo”');
      // Riservata: solo il messaggio di Members.
      const restricted = bySlug('pagina-riservata')?.descriptionSource ?? '';
      expect(restricted).toBe('Sorry, but you do not have permission to view this content.');
      expect(restricted).not.toContain('riservat');
      // Nessuna description nella sorgente: null, e decide l'API.
      expect(bySlug('pagina-divi-vuota')?.descriptionSource).toBeNull();
      expect(bySlug('pagina-divi-vuota')?.modifiedAt).toBeNull();
    } finally {
      await fresh.teardown();
    }
  });

  describe('pagina iniziale (DR-114)', () => {
    const run = async (db: Database, options: readonly SqlRow[]) => {
      const runId = await newApplyRunId(db);
      return runStage(contentsStage, {
        db,
        storage: fakeObjectStore(),
        source: buildContentsSource(BASE_POSTS, [], options),
        runId,
        mode: 'apply',
        issues: createIssueSink(db, 'apply', runId),
        options: OPTIONS,
      });
    };
    const homeSetting = async (db: Database) =>
      (
        await db
          .select({ value: schema.settings.value })
          .from(schema.settings)
          .where(eq(schema.settings.key, 'site.home_content_id'))
      )[0]?.value;

    it('`page_on_front` diventa `site.home_content_id`, con l’identificativo del contenuto importato', async () => {
      const fresh = await createTestDatabase('amoris_importer_contents_home');
      try {
        await run(fresh.db, [
          { option_id: 1, option_name: 'show_on_front', option_value: 'page' },
          { option_id: 2, option_name: 'page_on_front', option_value: '100' },
        ]);
        const [page] = await fresh.db
          .select({ id: schema.contents.id })
          .from(schema.contents)
          .where(eq(schema.contents.legacyId, 100));
        expect(await homeSetting(fresh.db)).toBe(page?.id);

        // Rieseguita, aggiorna e non duplica.
        await run(fresh.db, [
          { option_id: 1, option_name: 'show_on_front', option_value: 'page' },
          { option_id: 2, option_name: 'page_on_front', option_value: '100' },
        ]);
        expect(await homeSetting(fresh.db)).toBe(page?.id);
      } finally {
        await fresh.teardown();
      }
    });

    it('senza pagina iniziale statica, o con una pagina che non c’è, non inventa nulla', async () => {
      const fresh = await createTestDatabase('amoris_importer_contents_home_none');
      try {
        await run(fresh.db, [
          { option_id: 1, option_name: 'show_on_front', option_value: 'posts' },
          { option_id: 2, option_name: 'page_on_front', option_value: '100' },
        ]);
        expect(await homeSetting(fresh.db)).toBeUndefined();

        await run(fresh.db, [
          { option_id: 1, option_name: 'show_on_front', option_value: 'page' },
          { option_id: 2, option_name: 'page_on_front', option_value: '999' },
        ]);
        expect(await homeSetting(fresh.db)).toBeUndefined();
        const issues = await fresh.db
          .select({ code: schema.importIssues.category })
          .from(schema.importIssues);
        expect(issues.map((i) => i.code)).toContain('home-content-missing');
      } finally {
        await fresh.teardown();
      }
    });
  });
});
