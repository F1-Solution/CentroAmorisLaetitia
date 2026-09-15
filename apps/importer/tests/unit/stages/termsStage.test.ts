import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { termsStage } from '../../../src/stages/terms/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';
import type { Database } from '@amoris/db';

/** Vedi `settingsStage.test.ts`: `import_id_map.run_id` è vincolato a `import_runs`. */
async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

const TERMS_ROWS: readonly SqlRow[] = [
  { term_id: 10, name: 'Notizie', slug: 'notizie', term_group: 0 },
  { term_id: 11, name: 'Eventi', slug: 'eventi', term_group: 0 },
  { term_id: 99, name: 'Non categoria', slug: 'non-categoria', term_group: 0 },
];

const TAXONOMY_ROWS: readonly SqlRow[] = [
  {
    term_taxonomy_id: 1,
    term_id: 10,
    taxonomy: 'category',
    description: 'Le notizie del Centro',
    parent: 0,
    count: 5,
  },
  { term_taxonomy_id: 2, term_id: 11, taxonomy: 'category', description: '', parent: 10, count: 3 },
  { term_taxonomy_id: 3, term_id: 99, taxonomy: 'nav_menu', description: '', parent: 0, count: 0 },
];

function buildTermsSource(
  extraTaxonomy: readonly SqlRow[] = [],
  extraTerms: readonly SqlRow[] = [],
) {
  return fakeSourceReader({
    wp_terms: [...TERMS_ROWS, ...extraTerms],
    wp_term_taxonomy: [...TAXONOMY_ROWS, ...extraTaxonomy],
  });
}

const OPTIONS = { only: null, forceContentIds: [], verbose: false } as const;

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_terms');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase terms', () => {
  it('importa la tassonomia category, con gerarchia e percorso, e ignora nav_menu', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(termsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildTermsSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(2); // nav_menu escluso
    expect(result.errors).toBe(0);

    const terms = await testDb.db.select().from(schema.terms);
    expect(terms).toHaveLength(2);

    const root = terms.find((t) => t.slug === 'notizie');
    const child = terms.find((t) => t.slug === 'eventi');
    expect(root?.path).toBe('/category/notizie/');
    expect(root?.parentId).toBeNull();
    expect(child?.path).toBe('/category/notizie/eventi/');
    expect(child?.parentId).toBe(root?.id);
    expect(root?.taxonomy).toBe('category');
  });

  it('non crea righe per una tassonomia diversa da category', async () => {
    const terms = await testDb.db
      .select()
      .from(schema.terms)
      .where(eq(schema.terms.slug, 'non-categoria'));
    expect(terms).toHaveLength(0);
  });

  it('rieseguita aggiorna sul posto, non duplica', async () => {
    const before = await testDb.db.select().from(schema.terms);
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(termsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildTermsSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(2);

    const after = await testDb.db.select().from(schema.terms);
    expect(after).toHaveLength(2);
    expect(new Set(after.map((t) => t.id))).toEqual(new Set(before.map((t) => t.id)));

    const idMapRows = await testDb.db
      .select()
      .from(schema.importIdMap)
      .where(eq(schema.importIdMap.entity, 'term'));
    expect(idMapRows).toHaveLength(2);
  });

  it('un elemento sintetico corrotto (slug non valido) produce un errore e non ferma la fase', async () => {
    const fresh = await createTestDatabase('amoris_importer_terms_isolation');
    try {
      const brokenTerm: SqlRow = {
        term_id: 20,
        name: 'Rotto',
        slug: 'Slug Con Spazi!',
        term_group: 0,
      };
      const brokenTaxonomy: SqlRow = {
        term_taxonomy_id: 4,
        term_id: 20,
        taxonomy: 'category',
        description: '',
        parent: 0,
        count: 0,
      };

      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(termsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildTermsSource([brokenTaxonomy], [brokenTerm]),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(2); // notizie ed eventi, comunque creati
      expect(result.errors).toBe(1); // il termine rotto

      const terms = await fresh.db.select().from(schema.terms);
      expect(terms).toHaveLength(2);
      expect(terms.some((t) => t.slug === 'Slug Con Spazi!')).toBe(false);

      const failure = issues.collected.find((i) => i.code === 'item-import-failed');
      expect(failure).toBeDefined();
      expect(failure?.sourceTable).toBe('wp_terms');
      expect(failure?.sourceId).toBe(20);
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_terms_plan');
    try {
      const runId = randomUUID();
      const issues = createIssueSink(fresh.db, 'plan', runId);
      const result = await runStage(termsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildTermsSource(),
        runId,
        mode: 'plan',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(2);

      const terms = await fresh.db.select().from(schema.terms);
      expect(terms).toHaveLength(0);
      const idMapRows = await fresh.db.select().from(schema.importIdMap);
      expect(idMapRows).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });

  it('DR-061: importa anche wpdmcategory e cuar_private_file_category, ignorando le tassonomie non elencate', async () => {
    const fresh = await createTestDatabase('amoris_importer_terms_dr061_taxonomies');
    try {
      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const extraTerms: readonly SqlRow[] = [
        { term_id: 45, name: 'Moduli download', slug: 'moduli-download', term_group: 0 },
        { term_id: 41, name: 'Moduli riservati', slug: 'moduli-riservati', term_group: 0 },
      ];
      const extraTaxonomy: readonly SqlRow[] = [
        {
          term_taxonomy_id: 10,
          term_id: 45,
          taxonomy: 'wpdmcategory',
          description: '',
          parent: 0,
          count: 1,
        },
        {
          term_taxonomy_id: 11,
          term_id: 41,
          taxonomy: 'cuar_private_file_category',
          description: '',
          parent: 0,
          count: 1,
        },
      ];

      const result = await runStage(termsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildTermsSource(extraTaxonomy, extraTerms),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      // notizie, eventi, moduli-download, moduli-riservati; non-categoria resta escluso (nav_menu)
      expect(result.created).toBe(4);
      expect(result.errors).toBe(0);

      const terms = await fresh.db.select().from(schema.terms);
      expect(terms).toHaveLength(4);
      expect(terms.some((t) => t.taxonomy === 'wpdmcategory' && t.slug === 'moduli-download')).toBe(
        true,
      );
      expect(
        terms.some(
          (t) => t.taxonomy === 'cuar_private_file_category' && t.slug === 'moduli-riservati',
        ),
      ).toBe(true);
      expect(terms.some((t) => t.taxonomy === 'nav_menu')).toBe(false);
    } finally {
      await fresh.teardown();
    }
  });

  it('DR-061: stesso slug in due tassonomie diverse produce due percorsi distinti e viene scritto entrambe le volte', async () => {
    const fresh = await createTestDatabase('amoris_importer_terms_dr061_collision');
    try {
      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const collidingTerms: readonly SqlRow[] = [
        { term_id: 45, name: 'Moduli (download)', slug: 'moduli-consulenze', term_group: 0 },
        { term_id: 41, name: 'Moduli (riservati)', slug: 'moduli-consulenze', term_group: 0 },
      ];
      const collidingTaxonomy: readonly SqlRow[] = [
        {
          term_taxonomy_id: 10,
          term_id: 45,
          taxonomy: 'wpdmcategory',
          description: '',
          parent: 0,
          count: 1,
        },
        {
          term_taxonomy_id: 11,
          term_id: 41,
          taxonomy: 'cuar_private_file_category',
          description: '',
          parent: 0,
          count: 1,
        },
      ];

      const result = await runStage(termsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildTermsSource(collidingTaxonomy, collidingTerms),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.errors).toBe(0);

      const terms = await fresh.db
        .select()
        .from(schema.terms)
        .where(eq(schema.terms.slug, 'moduli-consulenze'));
      expect(terms).toHaveLength(2);

      const wpdm = terms.find((t) => t.taxonomy === 'wpdmcategory');
      const cuar = terms.find((t) => t.taxonomy === 'cuar_private_file_category');
      expect(wpdm?.path).toBe('/wpdmcategory/moduli-consulenze/');
      expect(cuar?.path).toBe('/cuar_private_file_category/moduli-consulenze/');
      expect(wpdm?.path).not.toBe(cuar?.path);
    } finally {
      await fresh.teardown();
    }
  });
});
