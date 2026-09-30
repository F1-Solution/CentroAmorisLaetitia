import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { contentsStage } from '../../../src/stages/contents/index.js';
import { relationsStage } from '../../../src/stages/relations/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
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

const POSTS: readonly SqlRow[] = [
  {
    ID: 300,
    post_author: 0,
    post_title: 'Genitore',
    post_content: '<p>Pagina radice.</p>',
    post_excerpt: '',
    post_status: 'publish',
    post_name: 'genitore',
    post_type: 'page',
    post_date: '2020-01-10 09:00:00',
    post_parent: 0,
    menu_order: 0,
  },
  {
    ID: 301,
    post_author: 0,
    post_title: 'Figlio',
    post_content: '<p>Sotto-pagina.</p>',
    post_excerpt: '',
    post_status: 'publish',
    post_name: 'figlio',
    post_type: 'page',
    post_date: '2020-01-11 09:00:00',
    post_parent: 300,
    menu_order: 0,
  },
  {
    ID: 302,
    post_author: 0,
    post_title: 'Articolo',
    post_content: '<p>Un articolo, senza genitore per vincolo di schema.</p>',
    post_excerpt: '',
    post_status: 'publish',
    post_name: 'articolo',
    post_type: 'post',
    post_date: '2020-01-12 09:00:00',
    post_parent: 0,
    menu_order: 0,
  },
];

const POSTMETA: readonly SqlRow[] = [
  { meta_id: 1, post_id: 300, meta_key: '_thumbnail_id', meta_value: 400 },
];

const TERM_RELATIONSHIPS: readonly SqlRow[] = [
  { object_id: 300, term_taxonomy_id: 1, term_order: 0 },
];

const TERM_TAXONOMY: readonly SqlRow[] = [
  { term_taxonomy_id: 1, term_id: 10, taxonomy: 'category', description: '', parent: 0, count: 1 },
];

async function seedMediaAndTerm(db: Database): Promise<{ mediaId: string; termId: string }> {
  const [media] = await db
    .insert(schema.media)
    .values({
      storageKey: '2020/01/copertina.jpg',
      publicPath: '/media/2020/01/copertina.jpg',
      fileName: 'copertina.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1,
      checksum: Buffer.from('00', 'hex'),
      isPrivate: false,
      uploadedAt: new Date(),
      legacyId: 400,
    })
    .returning({ id: schema.media.id });
  await db.insert(schema.importIdMap).values({
    sourceTable: 'wp_posts',
    sourceId: 400,
    entity: 'media',
    entityId: media!.id,
  });

  const [term] = await db
    .insert(schema.terms)
    .values({
      taxonomy: 'category',
      slug: 'notizie',
      name: 'Notizie',
      path: '/category/notizie/',
      legacyId: 10,
    })
    .returning({ id: schema.terms.id });
  await db.insert(schema.importIdMap).values({
    sourceTable: 'wp_terms',
    sourceId: 10,
    entity: 'term',
    entityId: term!.id,
  });

  return { mediaId: media!.id, termId: term!.id };
}

function buildSource() {
  return fakeSourceReader({
    wp_posts: POSTS,
    wp_postmeta: POSTMETA,
    wp_term_relationships: TERM_RELATIONSHIPS,
    wp_term_taxonomy: TERM_TAXONOMY,
  });
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_relations');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase relations', () => {
  it('calcola gerarchia e percorso, immagine in evidenza e termini', async () => {
    const { mediaId, termId } = await seedMediaAndTerm(testDb.db);

    const runId1 = await newApplyRunId(testDb.db);
    await runStage(contentsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId: runId1,
      mode: 'apply',
      issues: createIssueSink(testDb.db, 'apply', runId1),
      options: OPTIONS,
    });

    const runId2 = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId2);
    const result = await runStage(relationsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId: runId2,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.errors).toBe(0);
    expect(result.updated).toBe(3);

    const rows = await testDb.db.select().from(schema.contents);
    const parent = rows.find((r) => r.slug === 'genitore')!;
    const child = rows.find((r) => r.slug === 'figlio')!;
    const post = rows.find((r) => r.slug === 'articolo')!;

    expect(parent.parentId).toBeNull();
    expect(parent.path).toBe('/genitore/');
    expect(child.parentId).toBe(parent.id);
    expect(child.path).toBe('/genitore/figlio/');
    expect(post.parentId).toBeNull(); // gli articoli non hanno mai un genitore
    expect(post.path).toBe('/articolo/');

    expect(parent.featuredMediaId).toBe(mediaId);
    expect(child.featuredMediaId).toBeNull();

    const contentTerms = await testDb.db
      .select()
      .from(schema.contentTerms)
      .where(eq(schema.contentTerms.contentId, parent.id));
    expect(contentTerms).toHaveLength(1);
    expect(contentTerms[0]?.termId).toBe(termId);
  });

  it('rieseguita ricalcola senza duplicare i content_terms', async () => {
    const runId = await newApplyRunId(testDb.db);
    const result = await runStage(relationsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues: createIssueSink(testDb.db, 'apply', runId),
      options: OPTIONS,
    });
    expect(result.errors).toBe(0);

    const parent = (
      await testDb.db.select().from(schema.contents).where(eq(schema.contents.slug, 'genitore'))
    )[0]!;
    const contentTerms = await testDb.db
      .select()
      .from(schema.contentTerms)
      .where(eq(schema.contentTerms.contentId, parent.id));
    expect(contentTerms).toHaveLength(1);
  });

  it('un elemento sintetico corrotto (percorso reale già occupato) produce un errore isolato', async () => {
    const fresh = await createTestDatabase('amoris_importer_relations_isolation');
    try {
      await seedMediaAndTerm(fresh.db);

      const runId1 = await newApplyRunId(fresh.db);
      await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId1),
        options: OPTIONS,
      });

      // Un'altra riga occupa già il percorso reale che `figlio` dovrebbe
      // ricevere da `relations`: l'aggiornamento violerà il vincolo di
      // unicità su `path`.
      await fresh.db.insert(schema.contents).values({
        type: 'page',
        status: 'draft',
        slug: 'occupante',
        path: '/genitore/figlio/',
        title: 'Occupante',
        legacyId: 999997,
      });

      const runId2 = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId2);
      const result = await runStage(relationsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: runId2,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.errors).toBe(1); // figlio, in conflitto
      // genitore, articolo, e la riga "occupante" stessa (è anch'essa un
      // contenuto in `contents`, e `relations` ricalcola per ogni riga della
      // tabella, non solo per quelle appena importate da `contents`).
      expect(result.updated).toBe(3);

      const failure = issues.collected.find(
        (i) => i.code === 'item-import-failed' && i.sourceId === 301,
      );
      expect(failure).toBeDefined();
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_relations_plan');
    try {
      await seedMediaAndTerm(fresh.db);
      const runId1 = await newApplyRunId(fresh.db);
      await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId1),
        options: OPTIONS,
      });

      const before = await fresh.db.select().from(schema.contents);
      const planRunId = randomUUID();
      const result = await runStage(relationsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: planRunId,
        mode: 'plan',
        issues: createIssueSink(fresh.db, 'plan', planRunId),
        options: OPTIONS,
      });

      expect(result.updated).toBe(3);

      const after = await fresh.db.select().from(schema.contents);
      // Il percorso provvisorio della fase contents resta: `plan` annulla
      // tutto ciò che `relations` avrebbe scritto (`importer-spec.md` §5.2).
      expect(after.map((r) => r.path).sort()).toEqual(before.map((r) => r.path).sort());
    } finally {
      await fresh.teardown();
    }
  });
});

/**
 * DR-063 e DR-064 sulla catena `contents` → `relations`. Dati sintetici con la
 * **forma** dei due casi reali: un articolo pubblicato che condivide lo slug
 * con una pagina pubblicata, e una bozza senza slug.
 */
const ANOMALOUS_POSTS: readonly SqlRow[] = [
  {
    ID: 328,
    post_author: 0,
    post_title: 'Pagina omonima',
    post_content: '<p>La pagina che conserva l’indirizzo.</p>',
    post_excerpt: '',
    post_status: 'publish',
    post_name: 'omonimo',
    post_type: 'page',
    post_date: '2020-03-01 09:00:00',
    post_parent: 0,
    menu_order: 0,
  },
  {
    ID: 332,
    post_author: 0,
    post_title: 'Articolo omonimo',
    post_content: '<p>L’articolo con lo stesso slug.</p>',
    post_excerpt: '',
    post_status: 'publish',
    post_name: 'omonimo',
    post_type: 'post',
    post_date: '2020-03-02 09:00:00',
    post_parent: 0,
    menu_order: 0,
  },
  {
    ID: 1781,
    post_author: 0,
    post_title: '',
    post_content: '',
    post_excerpt: '',
    post_status: 'draft',
    post_name: '',
    post_type: 'post',
    post_date: '2020-03-03 09:00:00',
    post_parent: 0,
    menu_order: 0,
  },
];

function buildAnomalousSource() {
  return fakeSourceReader({
    wp_posts: ANOMALOUS_POSTS,
    wp_postmeta: [],
    wp_term_relationships: [],
    wp_term_taxonomy: [],
  });
}

describe('fase relations — contenuti anomali della sorgente (DR-063, DR-064)', () => {
  it('le due anomalie diventano bozze con percorso provvisorio, senza errori e senza togliere l’indirizzo alla pagina', async () => {
    const fresh = await createTestDatabase('amoris_importer_relations_anomalies');
    try {
      const runId1 = await newApplyRunId(fresh.db);
      const contentsResult = await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildAnomalousSource(),
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId1),
        options: OPTIONS,
      });
      expect(contentsResult.errors).toBe(0);

      // Già dopo `contents` l'articolo omonimo non è pubblicato: se
      // `relations` fallisse, non resterebbe in linea a un indirizzo inventato.
      const afterContents = await fresh.db.select().from(schema.contents);
      expect(afterContents.find((r) => r.legacyId === 332)?.status).toBe('draft');
      expect(afterContents.find((r) => r.legacyId === 328)?.status).toBe('published');

      const runId2 = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId2);
      const result = await runStage(relationsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildAnomalousSource(),
        runId: runId2,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.errors).toBe(0);
      expect(result.updated).toBe(3);

      const rows = await fresh.db.select().from(schema.contents);
      const page = rows.find((r) => r.legacyId === 328)!;
      const post = rows.find((r) => r.legacyId === 332)!;
      const draft = rows.find((r) => r.legacyId === 1781)!;

      expect(page.path).toBe('/omonimo/');
      expect(page.status).toBe('published');
      expect(post.path).toBe('/omonimo-332/');
      expect(post.status).toBe('draft');
      expect(draft.path).toBe('/senza-slug-1781/');
      expect(draft.status).toBe('draft');
      expect(new Set(rows.map((r) => r.path)).size).toBe(rows.length);

      const provisional = issues.collected.filter((i) => i.code === 'content-path-provisional');
      expect(provisional.map((i) => [i.sourceId, i.detail]).sort()).toEqual([
        [1781, 'empty-slug'],
        [332, 'path-collision'],
      ]);
      expect(provisional.every((i) => i.severity === 'warning')).toBe(true);

      // Rieseguire non cambia l'esito: stessa pagina, stesse bozze.
      const runId3 = await newApplyRunId(fresh.db);
      await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildAnomalousSource(),
        runId: runId3,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId3),
        options: OPTIONS,
      });
      const again = await runStage(relationsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildAnomalousSource(),
        runId: runId3,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId3),
        options: OPTIONS,
      });
      expect(again.errors).toBe(0);
      const rowsAgain = await fresh.db.select().from(schema.contents);
      expect(rowsAgain.map((r) => [r.legacyId, r.path, r.status]).sort()).toEqual(
        rows.map((r) => [r.legacyId, r.path, r.status]).sort(),
      );
    } finally {
      await fresh.teardown();
    }
  });
});

describe('fase relations — protezione del lavoro redazionale', () => {
  it('non tocca un contenuto che la fase contents ha protetto per una copia di lavoro recente', async () => {
    const fresh = await createTestDatabase('amoris_importer_relations_protected');
    try {
      await seedMediaAndTerm(fresh.db);
      const runId1 = await newApplyRunId(fresh.db);
      await runStage(contentsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId1),
        options: OPTIONS,
      });
      await runStage(relationsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId1),
        options: OPTIONS,
      });
      await fresh.db
        .update(schema.importRuns)
        .set({ finishedAt: new Date(), outcome: 'success' })
        .where(eq(schema.importRuns.id, runId1));

      const [parent] = await fresh.db
        .select()
        .from(schema.contents)
        .where(eq(schema.contents.legacyId, 300));
      await new Promise((resolve) => setTimeout(resolve, 20));
      const [redattore] = await fresh.db
        .insert(schema.users)
        .values({ email: 'redattore@example.test', fullName: 'Redattore di prova' })
        .returning({ id: schema.users.id });
      await fresh.db.insert(schema.contentDrafts).values({
        contentId: parent!.id,
        authorId: redattore!.id,
        title: 'Bozza in corso',
        blocks: { schema: 1, blocks: [] },
        baseUpdatedAt: parent!.updatedAt,
      });

      const runId2 = await newApplyRunId(fresh.db);
      const result = await runStage(relationsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId: runId2,
        mode: 'apply',
        issues: createIssueSink(fresh.db, 'apply', runId2),
        options: OPTIONS,
      });

      expect(result.skipped).toBe(1);
      expect(result.updated).toBe(2);
      const [after] = await fresh.db
        .select({ updatedAt: schema.contents.updatedAt })
        .from(schema.contents)
        .where(eq(schema.contents.id, parent!.id));
      // `updated_at` immutato: la copia di lavoro resta pubblicabile.
      expect(after?.updatedAt.getTime()).toBe(parent!.updatedAt.getTime());
    } finally {
      await fresh.teardown();
    }
  });
});
