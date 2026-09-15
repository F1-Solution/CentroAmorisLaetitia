/**
 * Fase `legacy` (`importer-spec.md` §4, DR-026). Dati **sintetici**: nessun
 * valore di questa sorgente vera, nessun indirizzo IP reale. Copre:
 * l'inserimento di entrambe le tabelle; la riesecuzione conta `skipped`, mai
 * `updated`; il `payload` di `legacy_download_stats` non contiene
 * l'indirizzo IP in chiaro (asserzione esplicita).
 */
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { legacyStage } from '../../../src/stages/legacy/index.js';
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

const TEST_IP = '198.51.100.7';

const EMAIL_LOG_ROWS: readonly SqlRow[] = [
  {
    id: 5001,
    content: 'Messaggio di fantasia inviato a destinatario@example.invalid',
    initiator: 'wp_mail',
    event_type: 'email_sent',
    created_at: '2026-01-05 09:00:00',
  },
  {
    id: 5002,
    content: 'Secondo messaggio di fantasia',
    initiator: 'wp_mail',
    event_type: 'email_failed',
    created_at: '2026-01-06 09:00:00',
  },
];

const DOWNLOAD_STATS_ROWS: readonly SqlRow[] = [
  {
    id: 9001,
    pid: 42,
    uid: 0,
    year: 2026,
    month: 1,
    day: 5,
    timestamp: 1767603600, // 2026-01-05, sintetico
    ip: TEST_IP,
    filename: 'documento-di-fantasia.pdf',
    agent: 'FakeAgent/1.0',
  },
];

function buildSource() {
  return fakeSourceReader({
    wp_wpmailsmtp_debug_events: EMAIL_LOG_ROWS,
    wp_ahm_download_stats: DOWNLOAD_STATS_ROWS,
  });
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_legacy');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase legacy', () => {
  it('inserisce le righe di entrambe le tabelli di conservazione', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(legacyStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
      ipHashSalt: TEST_SALT,
    });

    expect(result.created).toBe(3); // 2 email + 1 download
    expect(result.errors).toBe(0);

    const emailLog = await testDb.db.select().from(schema.legacyEmailLog);
    expect(emailLog).toHaveLength(2);

    const downloadStats = await testDb.db.select().from(schema.legacyDownloadStats);
    expect(downloadStats).toHaveLength(1);
  });

  it('il payload di legacy_download_stats non contiene l’indirizzo IP in chiaro', async () => {
    const [stat] = await testDb.db
      .select()
      .from(schema.legacyDownloadStats)
      .where(eq(schema.legacyDownloadStats.legacyId, 9001));

    expect(stat).toBeDefined();
    const payload = stat!.payload as Record<string, unknown>;

    // Asserzione esplicita: l'indirizzo non compare da nessuna parte nella riga.
    // `id` è un `bigint` (colonna `bigserial`): non serializzabile in JSON, si esclude.
    const { id: _id, ...serializable } = stat!;
    expect(JSON.stringify(serializable)).not.toContain(TEST_IP);

    const expectedDigest = createHash('sha256')
      .update(`${TEST_SALT}${TEST_IP}`, 'utf8')
      .digest('hex');
    expect(payload['ipHashHex']).toBe(expectedDigest);
    expect(payload['filename']).toBe('documento-di-fantasia.pdf');
  });

  it('rieseguita conta skipped, mai updated, e non inserisce righe duplicate', async () => {
    const beforeEmail = await testDb.db.select().from(schema.legacyEmailLog);
    const beforeDownload = await testDb.db.select().from(schema.legacyDownloadStats);

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(legacyStage, {
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
    expect(result.skipped).toBe(3);

    const afterEmail = await testDb.db.select().from(schema.legacyEmailLog);
    const afterDownload = await testDb.db.select().from(schema.legacyDownloadStats);
    expect(afterEmail).toHaveLength(beforeEmail.length);
    expect(afterDownload).toHaveLength(beforeDownload.length);
  });
});
