/**
 * Orchestratore degli 8 controlli di preflight (`importer-spec.md` §5). Se uno
 * solo fallisce, l'importer non parte (`cli/commands/plan.ts`,
 * `cli/commands/apply.ts`).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Database } from '@amoris/db';
import { schema } from '@amoris/db';
import { isNull, sql } from 'drizzle-orm';
import type { S3Client } from '@aws-sdk/client-s3';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import type { SourceReader } from '../source/index.js';
import { checkDumpFingerprint } from './checks/01-dump-fingerprint.js';
import { checkTablesPresent } from './checks/02-tables-present.js';
import { checkMetaKeysClassified } from './checks/03-meta-keys-classified.js';
import { checkPostTypesClassified } from './checks/04-post-types-classified.js';
import { checkSchemaVersion } from './checks/05-schema-version.js';
import { checkStorageReachable } from './checks/06-storage-reachable.js';
import { checkUploadsCount } from './checks/07-uploads-count.js';
import { checkNoOpenRuns } from './checks/08-no-open-runs.js';
import { EXPECTED_DUMP_FINGERPRINT, EXPECTED_TABLES, EXPECTED_UPLOADS_FILE_COUNT } from './constants.js';
import type { PreflightReport } from './types.js';

export interface PreflightDependencies {
  readonly source: SourceReader;
  readonly db: Database;
  readonly s3: S3Client;
  readonly buckets: readonly [publicBucket: string, privateBucket: string];
}

async function readMigrationJournalTags(): Promise<readonly string[]> {
  const require = createRequire(import.meta.url);
  const dbEntry = require.resolve('@amoris/db');
  const dbRoot = path.dirname(path.dirname(dbEntry)); // src/index.ts -> src -> radice del pacchetto
  const journalPath = path.join(dbRoot, 'drizzle', 'meta', '_journal.json');
  const journal = JSON.parse(await readFile(journalPath, 'utf-8')) as {
    entries: readonly { tag: string }[];
  };
  return journal.entries.map((entry) => entry.tag);
}

async function readAppliedMigrationCount(db: Database): Promise<number> {
  const rows = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from drizzle."__drizzle_migrations"`,
  );
  return Number(rows[0]?.count ?? 0);
}

export async function runPreflight(deps: PreflightDependencies): Promise<PreflightReport> {
  const { source, db, s3, buckets } = deps;

  const fingerprint = await source.fingerprint();
  const check1 = checkDumpFingerprint(fingerprint, EXPECTED_DUMP_FINGERPRINT);

  const tableNames = await source.tableNames();
  const check2 = checkTablesPresent(tableNames, EXPECTED_TABLES);

  const postmetaRows = await source.rows('wp_postmeta');
  const distinctMetaKeys = Array.from(
    new Set(postmetaRows.map((row) => String(row['meta_key'] ?? ''))),
  ).filter((key) => key.length > 0);
  const check3 = checkMetaKeysClassified(distinctMetaKeys);

  const postsRows = await source.rows('wp_posts');
  const distinctPostTypes = Array.from(
    new Set(postsRows.map((row) => String(row['post_type'] ?? ''))),
  ).filter((type) => type.length > 0);
  const check4 = checkPostTypesClassified(distinctPostTypes);

  const expectedTags = await readMigrationJournalTags();
  const appliedCount = await readAppliedMigrationCount(db);
  const appliedTags = expectedTags.slice(0, appliedCount);
  const check5 = checkSchemaVersion(appliedTags, expectedTags);

  const check6 = await checkStorageReachable(
    {
      probe: async (bucket) => {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        return true;
      },
    },
    buckets,
  );

  const uploadedFiles = await source.uploadedFiles();
  const check7 = checkUploadsCount(uploadedFiles, EXPECTED_UPLOADS_FILE_COUNT);

  const openRuns = await db
    .select({ id: schema.importRuns.id })
    .from(schema.importRuns)
    .where(isNull(schema.importRuns.finishedAt));
  const check8 = checkNoOpenRuns(openRuns);

  const results = [check1, check2, check3, check4, check5, check6, check7, check8];
  return { ok: results.every((r) => r.ok), results };
}
