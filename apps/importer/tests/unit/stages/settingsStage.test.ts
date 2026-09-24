import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@amoris/db';
import { settingsStage } from '../../../src/stages/settings/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';
import type { Database } from '@amoris/db';

/**
 * `import_id_map.run_id` e `import_issues.run_id` sono vincolati a
 * `import_runs` (`packages/db/drizzle`): in `apply` una riga vera deve
 * esistere prima di eseguire una fase — `cli/commands/apply.ts` la crea con
 * `createRun` prima del preflight. Questo helper fa lo stesso nei test.
 */
async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_settings');
});

afterAll(async () => {
  await testDb.teardown();
});

const OPTIONS_ROWS: readonly SqlRow[] = [
  { option_id: 1, option_name: 'blogname', option_value: 'Centro per la Famiglia' },
  { option_id: 2, option_name: 'blogdescription', option_value: '' },
  { option_id: 3, option_name: 'timezone_string', option_value: 'Europe/Rome' },
  { option_id: 4, option_name: 'WPLANG', option_value: '' },
  { option_id: 5, option_name: 'date_format', option_value: 'd/m/Y' },
  { option_id: 6, option_name: 'time_format', option_value: 'H:i' },
  { option_id: 7, option_name: 'start_of_week', option_value: '1' },
  { option_id: 8, option_name: 'posts_per_page', option_value: '10' },
];

function buildOptions(overrides: readonly SqlRow[] = OPTIONS_ROWS) {
  return fakeSourceReader({ wp_options: overrides });
}

const OPTIONS = { only: null, forceContentIds: [], verbose: false } as const;

describe('fase settings', () => {
  it('crea 15 impostazioni e 6 template SEO alla prima esecuzione', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(settingsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildOptions(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(21);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(0);

    const settingsRows = await testDb.db.select().from(schema.settings);
    expect(settingsRows).toHaveLength(15);

    const seoRows = await testDb.db.select().from(schema.seoTemplates);
    expect(seoRows).toHaveLength(6);

    const title = settingsRows.find((r) => r.key === 'site.title');
    expect(title?.value).toBe('Centro per la Famiglia');

    const categoryTemplate = seoRows.find((r) => r.scope === 'category');
    expect(categoryTemplate?.titleTemplate).toBe('{term_title} - {site_title}');
    expect(categoryTemplate?.descriptionTemplate).toBeNull();
  });

  it('non usa import_id_map: nessuna riga per chiave naturale', async () => {
    const rows = await testDb.db.select().from(schema.importIdMap);
    const settingRows = rows.filter((r) => r.entity === 'setting' || r.entity === 'seo_template');
    expect(settingRows).toHaveLength(0);
  });

  it('rieseguita, aggiorna sul posto senza duplicare', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(settingsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildOptions(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(21);

    const settingsRows = await testDb.db.select().from(schema.settings);
    expect(settingsRows).toHaveLength(15);
    const seoRows = await testDb.db.select().from(schema.seoTemplates);
    expect(seoRows).toHaveLength(6);
  });

  it('una opzione mancante nella sorgente produce un avviso e non blocca la fase', async () => {
    const withoutTitle = OPTIONS_ROWS.filter((r) => r['option_name'] !== 'blogname');
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(settingsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildOptions(withoutTitle),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.errors).toBe(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    const missing = issues.collected.find((i) => i.code === 'settings-value-missing');
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe('warning');
  });

  it('in modo plan non scrive nulla: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_settings_plan');
    try {
      const before = await fresh.db.select().from(schema.settings);
      expect(before).toHaveLength(0);

      const runId = randomUUID();
      const issues = createIssueSink(fresh.db, 'plan', runId);
      const result = await runStage(settingsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildOptions(),
        runId,
        mode: 'plan',
        issues,
        options: OPTIONS,
      });

      // Il conteggio è vero (la transazione ha scritto per davvero prima di annullarsi).
      expect(result.created).toBe(21);

      const after = await fresh.db.select().from(schema.settings);
      expect(after).toHaveLength(0);
      const afterSeo = await fresh.db.select().from(schema.seoTemplates);
      expect(afterSeo).toHaveLength(0);
      // In plan non si scrive nemmeno import_issues.
      const issueRows = await fresh.db.select().from(schema.importIssues);
      expect(issueRows).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });
});
