import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { seoStage, translateAioseoTitle } from '../../../src/stages/seo/index.js';
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

const AIOSEO_ROWS: readonly SqlRow[] = [
  {
    id: 1,
    post_id: 100,
    title: 'Titolo personalizzato - Centro Amoris Laetitia',
    description: '',
    canonical_url: '',
    robots_default: '1',
    robots_noindex: '0',
    robots_nofollow: '0',
  },
  {
    id: 2,
    post_id: 101,
    title: '',
    description: '',
    canonical_url: '',
    robots_default: '0',
    robots_noindex: '1',
    robots_nofollow: '1',
  },
  // nessuna sovrascrittura: si scarta, non produce una riga content_seo vuota
  {
    id: 3,
    post_id: 102,
    title: '',
    description: '',
    canonical_url: '',
    robots_default: '1',
    robots_noindex: '0',
    robots_nofollow: '0',
  },
  // riferimento non risolvibile: nessun contenuto con questo legacyId
  {
    id: 4,
    post_id: 999999,
    title: 'Fantasma',
    description: '',
    canonical_url: '',
    robots_default: '1',
    robots_noindex: '0',
    robots_nofollow: '0',
  },
];

function buildSource(rows: readonly SqlRow[] = AIOSEO_ROWS) {
  return fakeSourceReader({ wp_aioseo_posts: rows });
}

async function seedContent(db: Database, legacyId: number, slug: string): Promise<string> {
  const [content] = await db
    .insert(schema.contents)
    .values({ type: 'page', status: 'draft', slug, path: `/${slug}/`, title: slug, legacyId })
    .returning({ id: schema.contents.id });
  await db.insert(schema.importIdMap).values({
    sourceTable: 'wp_posts',
    sourceId: legacyId,
    entity: 'content',
    entityId: content!.id,
  });
  return content!.id;
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_seo');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase seo', () => {
  it('importa solo le sovrascritture non vuote di content_seo, con robots non predefiniti', async () => {
    await seedContent(testDb.db, 100, 'pagina-con-titolo');
    await seedContent(testDb.db, 101, 'pagina-con-robots');
    await seedContent(testDb.db, 102, 'pagina-senza-sovrascritture');

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(seoStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(2); // le righe 1 e 2; la 3 non ha nulla da sovrascrivere
    expect(result.skipped).toBe(1); // la 4, riferimento non risolvibile

    const rows = await testDb.db.select().from(schema.contentSeo);
    expect(rows).toHaveLength(2);

    const withTitle = rows.find((r) => r.title !== null);
    expect(withTitle?.title).toBe('Titolo personalizzato - Centro Amoris Laetitia');
    expect(withTitle?.robotsNoindex).toBe(false);

    const withRobots = rows.find((r) => r.robotsNoindex === true);
    expect(withRobots?.robotsNofollow).toBe(true);
    expect(withRobots?.title).toBeNull();

    const warning = issues.collected.find((i) => i.detail === 'unresolved-content-reference');
    expect(warning?.sourceId).toBe(4);
  });

  it('non produce righe term_seo: nessuna sorgente per questo dump', async () => {
    const termSeoRows = await testDb.db.select().from(schema.termSeo);
    expect(termSeoRows).toHaveLength(0);
  });

  it('rieseguita aggiorna sul posto, non duplica', async () => {
    const before = await testDb.db.select().from(schema.contentSeo);
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(seoStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(2);

    const after = await testDb.db.select().from(schema.contentSeo);
    expect(after).toHaveLength(2);
    expect(new Set(after.map((r) => r.contentId))).toEqual(new Set(before.map((r) => r.contentId)));
  });

  it('un elemento sintetico corrotto (`import_id_map` punta a un contenuto ormai cancellato) produce un errore e non ferma la fase', async () => {
    const fresh = await createTestDatabase('amoris_importer_seo_isolation');
    try {
      const validContentId = await seedContent(fresh.db, 200, 'pagina-valida');
      const danglingContentId = await seedContent(fresh.db, 201, 'pagina-poi-cancellata');
      // `import_id_map` resta con un riferimento a un contenuto non più
      // esistente: anomalia sintetica, come `mediaStage.test.ts` per un file
      // mancante — qui viola il vincolo di chiave esterna su `content_seo`.
      await fresh.db.delete(schema.contents).where(eq(schema.contents.id, danglingContentId));

      const rows: SqlRow[] = [
        {
          id: 10,
          post_id: 200,
          title: 'Valida - Centro Amoris Laetitia',
          description: '',
          canonical_url: '',
          robots_default: '1',
          robots_noindex: '0',
          robots_nofollow: '0',
        },
        {
          id: 11,
          post_id: 201,
          title: 'Corrotta - Centro Amoris Laetitia',
          description: '',
          canonical_url: '',
          robots_default: '1',
          robots_noindex: '0',
          robots_nofollow: '0',
        },
      ];

      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(seoStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(rows),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(1); // la valida, comunque creata
      expect(result.errors).toBe(1); // la corrotta

      const seoRows = await fresh.db.select().from(schema.contentSeo);
      expect(seoRows).toHaveLength(1);
      expect(seoRows[0]?.contentId).toBe(validContentId);

      const failure = issues.collected.find((i) => i.code === 'item-import-failed');
      expect(failure).toBeDefined();
      expect(failure?.sourceId).toBe(11);
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_seo_plan');
    try {
      await seedContent(fresh.db, 100, 'pagina-con-titolo');
      await seedContent(fresh.db, 101, 'pagina-con-robots');
      const runId = randomUUID();
      const issues = createIssueSink(fresh.db, 'plan', runId);
      const result = await runStage(seoStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId,
        mode: 'plan',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(2);
      const rows = await fresh.db.select().from(schema.contentSeo);
      expect(rows).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });

  it('traduce le variabili di All in One SEO nel modello del sito e tiene la riga (DR-174, DR-191)', async () => {
    const fresh = await createTestDatabase('amoris_importer_seo_variables');
    try {
      await seedContent(fresh.db, 300, 'pagina-con-variabili');
      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(seoStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: fakeSourceReader({
          wp_aioseo_posts: [
            {
              id: 30,
              post_id: 300,
              title: '#separator_sa #separator_sa #post_title #separator_sa #site_title',
              description: '',
              canonical_url: '',
              robots_default: '1',
              robots_noindex: '0',
              robots_nofollow: '0',
            },
          ],
          wp_options: [
            {
              option_id: 1,
              option_name: 'aioseo_options',
              option_value: JSON.stringify({
                searchAppearance: { global: { separator: '&#45;' } },
              }),
            },
            { option_id: 2, option_name: 'blogdescription', option_value: '' },
          ],
        }),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });
      expect(result.created).toBe(1);
      const [row] = await fresh.db.select().from(schema.contentSeo);
      expect(row?.title).toBe('{title} - {site_title}');
      expect(issues.collected.filter((i) => i.stage === 'seo')).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });
});

describe('translateAioseoTitle', () => {
  const options = { separator: '-', tagline: '' };

  it('un titolo senza variabili resta com’è', () => {
    expect(translateAioseoTitle('Home - Centro Amoris Laetitia', options)).toEqual({
      title: 'Home - Centro Amoris Laetitia',
      unknown: [],
      taglineMissing: false,
    });
  });

  it('toglie i separatori vuoti in testa e in coda', () => {
    expect(translateAioseoTitle('#separator_sa #post_title #separator_sa', options).title).toBe(
      '{title}',
    );
  });

  it('#tagline: il testo dello slogan se c’è, altrimenti vuoto e segnalato', () => {
    expect(
      translateAioseoTitle('#site_title #separator_sa #tagline', { separator: '|', tagline: 'Slogan' })
        .title,
    ).toBe('{site_title} | Slogan');
    const missing = translateAioseoTitle('#site_title #separator_sa #tagline', options);
    expect(missing.title).toBe('{site_title}');
    expect(missing.taglineMissing).toBe(true);
  });

  it('una variabile sconosciuta resta scritta ed è riportata', () => {
    const result = translateAioseoTitle('#post_title #separator_sa #categoria_ignota', options);
    expect(result.title).toBe('{title} - #categoria_ignota');
    expect(result.unknown).toEqual(['categoria_ignota']);
  });
});
