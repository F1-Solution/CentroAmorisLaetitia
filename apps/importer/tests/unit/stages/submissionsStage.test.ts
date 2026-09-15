/**
 * Fase `submissions` (`importer-spec.md` §4, ADR-010 §4.6). Dati
 * **sintetici**: nessun valore di questa sorgente vera, nessun indirizzo IP
 * reale. Copre: `origin = 'migration'`; `ipHash` non contiene l'indirizzo e
 * coincide con il digest atteso per un sale di prova noto; la riesecuzione
 * conta `skipped`, mai `updated`, e il numero di righe non cambia; le colonne
 * di stato del plugin non finiscono nel `payload`.
 */
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { formsStage } from '../../../src/stages/forms/index.js';
import { submissionsStage } from '../../../src/stages/submissions/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';
import type { Database } from '@amoris/db';

const TEST_SALT = 'un-sale-di-prova-non-reale';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

const OPTIONS = { only: null, forceContentIds: [], verbose: false } as const;

const FORM_ROW: SqlRow = {
  ID: 301,
  post_type: 'wpforms',
  post_status: 'publish',
  post_name: 'iscrizione-di-prova',
  post_title: 'Iscrizione di prova',
  post_content: JSON.stringify({
    fields: { 1: { id: '1', type: 'text', label: 'Nome di fantasia', required: '1' } },
    id: 1,
    field_id: 2,
    settings: { form_title: 'Iscrizione di prova', notification_enable: '0', notifications: {} },
    payments: {},
    meta: {},
  }),
};

const ENTRY_ROWS: readonly SqlRow[] = [
  {
    entry_id: 1001,
    form_id: 301,
    post_id: 0,
    user_id: 0,
    status: '',
    type: '',
    viewed: 1,
    starred: 0,
    fields: JSON.stringify({ 1: { name: 'Nome Fantasia Uno', value: 'Nome Fantasia Uno' } }),
    meta: '{}',
    date: '2026-01-05 10:00:00',
    date_modified: '2026-01-05 10:00:00',
    ip_address: '203.0.113.5',
    user_agent: 'FakeAgent/1.0',
    user_uuid: 'uuid-finto-1',
  },
  {
    entry_id: 1002,
    form_id: 301,
    post_id: 0,
    user_id: 0,
    status: '',
    type: '',
    viewed: 0,
    starred: 0,
    fields: JSON.stringify({ 1: { name: 'Nome Fantasia Due', value: 'Nome Fantasia Due' } }),
    meta: '{}',
    date: '2026-01-06 11:00:00',
    date_modified: '2026-01-06 11:00:00',
    ip_address: '203.0.113.9',
    user_agent: 'FakeAgent/2.0',
    user_uuid: 'uuid-finto-2',
  },
  {
    // Riferisce un form mai importato: deve isolarsi come errore, non fermare la fase.
    entry_id: 1003,
    form_id: 999999,
    post_id: 0,
    user_id: 0,
    status: '',
    type: '',
    viewed: 0,
    starred: 0,
    fields: JSON.stringify({ 1: { name: 'Nome Fantasia Tre', value: 'Nome Fantasia Tre' } }),
    meta: '{}',
    date: '2026-01-07 12:00:00',
    date_modified: '2026-01-07 12:00:00',
    ip_address: '203.0.113.10',
    user_agent: 'FakeAgent/3.0',
    user_uuid: 'uuid-finto-3',
  },
];

const ENTRY_META_ROWS: readonly SqlRow[] = [
  { id: 1, entry_id: 1001, type: 'log', data: 'voce di log sintetica uno' },
  { id: 2, entry_id: 1002, type: 'log', data: 'voce di log sintetica due' },
];

function buildSource() {
  return fakeSourceReader({
    wp_posts: [FORM_ROW],
    wp_wpforms_entries: ENTRY_ROWS,
    wp_wpforms_entry_meta: ENTRY_META_ROWS,
  });
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_submissions');

  // La fase submissions dipende da forms: si importa prima il form di prova.
  const formsRunId = await newApplyRunId(testDb.db);
  await runStage(formsStage, {
    db: testDb.db,
    storage: fakeObjectStore(),
    source: buildSource(),
    runId: formsRunId,
    mode: 'apply',
    issues: createIssueSink(testDb.db, 'apply', formsRunId),
    options: OPTIONS,
    ipHashSalt: TEST_SALT,
  });
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase submissions', () => {
  it('importa le compilazioni con origin migration, isolando quella con form irrisolvibile', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(submissionsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
      ipHashSalt: TEST_SALT,
    });

    expect(result.created).toBe(2); // 1001, 1002
    expect(result.errors).toBe(1); // 1003, form non risolvibile

    const submissions = await testDb.db.select().from(schema.formSubmissions);
    expect(submissions).toHaveLength(2);
    expect(submissions.every((s) => s.origin === 'migration')).toBe(true);

    const failure = issues.collected.find((i) => i.code === 'item-import-failed');
    expect(failure?.sourceTable).toBe('wp_wpforms_entries');
    expect(failure?.sourceId).toBe(1003);
  });

  it('ipHash è il digest atteso, mai l’indirizzo in chiaro', async () => {
    const [submission] = await testDb.db
      .select()
      .from(schema.formSubmissions)
      .where(eq(schema.formSubmissions.legacyId, 1001));

    expect(submission).toBeDefined();
    const ipHash = submission!.ipHash;
    expect(ipHash).not.toBeNull();

    const expectedDigest = createHash('sha256').update(`${TEST_SALT}203.0.113.5`, 'utf8').digest();
    expect(Buffer.isBuffer(ipHash)).toBe(true);
    expect((ipHash as Buffer).equals(expectedDigest)).toBe(true);

    // Non contiene l'indirizzo: né come sottostringa binaria banale, né altrove nella riga.
    expect((ipHash as Buffer).toString('utf8')).not.toContain('203.0.113.5');
    expect(JSON.stringify(submission)).not.toContain('203.0.113.5');
  });

  it('il payload non contiene le colonne di stato del plugin', async () => {
    const [submission] = await testDb.db
      .select()
      .from(schema.formSubmissions)
      .where(eq(schema.formSubmissions.legacyId, 1001));

    const payload = submission!.payload as Record<string, unknown>;
    const forbiddenKeys = [
      'status',
      'type',
      'viewed',
      'starred',
      'post_id',
      'user_id',
      'user_uuid',
    ];
    for (const key of forbiddenKeys) {
      expect(Object.keys(payload)).not.toContain(key);
    }
    expect(payload).toHaveProperty('fields');
    expect(payload).toHaveProperty('legacyMeta');
  });

  it('rieseguita conta skipped, mai updated: le compilazioni sono un fatto storico', async () => {
    const before = await testDb.db.select().from(schema.formSubmissions);

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(submissionsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
      ipHashSalt: TEST_SALT,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.errors).toBe(1); // 1003 fallisce di nuovo, sempre isolato

    const after = await testDb.db.select().from(schema.formSubmissions);
    expect(after).toHaveLength(before.length);
    expect(new Set(after.map((s) => s.id))).toEqual(new Set(before.map((s) => s.id)));
  });
});
