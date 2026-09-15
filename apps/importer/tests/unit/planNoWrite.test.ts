import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createDatabase, schema, type Database } from '@amoris/db';
import type { S3Client } from '@aws-sdk/client-s3';
import { runPlan } from '../../src/cli/commands/plan.js';
import { runApply } from '../../src/cli/commands/apply.js';
import type { Runtime } from '../../src/cli/bootstrap.js';
import type { SourceReader } from '../../src/source/index.js';
import { EXPECTED_DUMP_FINGERPRINT, EXPECTED_TABLES, EXPECTED_UPLOADS_FILE_COUNT } from '../../src/preflight/constants.js';
import { createLogger } from '../../src/runtime/logger.js';
import type { Config } from '../../src/runtime/config.js';

/**
 * Prova che `plan` non scrive nulla (`importer-spec.md` §14 punto 1), e che
 * `apply --confirm` invece scrive: si confronta lo stato del database prima e
 * dopo, come impone `IMPORTER-DESIGN.md` §6.5. Il preflight è fatto passare
 * con una sorgente e uno storage finti, così il test non dipende dalla
 * sorgente reale né da MinIO in esecuzione.
 */

const DB_DI_PROVA = `amoris_importer_test_${process.pid}`;
const migrationsFolder = path.join(
  path.dirname(createRequire(import.meta.url).resolve('@amoris/db')),
  '..',
  'drizzle',
);

const baseUrl = process.env.DATABASE_URL ?? 'postgres://amoris:sviluppo-locale@localhost:5432/amoris';

function urlForDatabase(name: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

let admin: ReturnType<typeof postgres>;
let database: ReturnType<typeof createDatabase>;

function fakeSourceReader(): SourceReader {
  return {
    dumpPath: '/finto/dump.sql',
    uploadsPath: '/finto/uploads',
    fingerprint: async () => EXPECTED_DUMP_FINGERPRINT,
    dump: async () => ({ tables: new Map(), rows: new Map(), issues: [] }),
    tableNames: async () => EXPECTED_TABLES,
    rows: async () => [],
    uploadedFiles: async () =>
      Array.from({ length: EXPECTED_UPLOADS_FILE_COUNT }, (_, i) => ({
        relativePath: `2026/09/file-${i}.jpg`,
        sizeBytes: 1,
      })),
  };
}

function fakeS3(): S3Client {
  return { send: async () => ({}) } as unknown as S3Client;
}

function buildRuntime(db: Database): Runtime {
  const config: Config = {
    NODE_ENV: 'test',
    DATABASE_URL: baseUrl,
    S3_ENDPOINT: 'http://finto:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY: 'finto',
    S3_SECRET_KEY: 'finto',
    S3_BUCKET_PUBLIC: 'media-public',
    S3_BUCKET_PRIVATE: 'media-private',
    IMPORTER_DUMP_PATH: '/finto/dump.sql',
    IMPORTER_UPLOADS_PATH: '/finto/uploads',
  };
  return {
    config,
    db,
    s3: fakeS3(),
    source: fakeSourceReader(),
    logger: createLogger({ verbose: false }),
    monorepoRoot: '/finto',
    close: async () => {},
  };
}

beforeAll(async () => {
  admin = postgres(urlForDatabase('postgres'), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${DB_DI_PROVA}" with (force)`);
  await admin.unsafe(`create database "${DB_DI_PROVA}"`);
  const client = postgres(urlForDatabase(DB_DI_PROVA), { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder });
  await client.end({ timeout: 5 });
  database = createDatabase({ url: urlForDatabase(DB_DI_PROVA) });
});

afterAll(async () => {
  await database?.close();
  await admin?.unsafe(`drop database if exists "${DB_DI_PROVA}" with (force)`);
  await admin?.end({ timeout: 5 });
});

async function countRuns(): Promise<number> {
  const rows = await database.db.select({ id: schema.importRuns.id }).from(schema.importRuns);
  return rows.length;
}

describe('plan non scrive, apply sì', () => {
  it('plan lascia import_runs invariato', async () => {
    const before = await countRuns();
    const code = await runPlan(buildRuntime(database.db));
    expect(code).toBe(0);
    const after = await countRuns();
    expect(after).toBe(before);
  });

  it('apply --confirm crea una riga in import_runs', async () => {
    const before = await countRuns();
    const code = await runApply(buildRuntime(database.db), {
      command: 'apply',
      confirm: true,
      stage: null,
      only: null,
      verbose: false,
      run: null,
      forceContent: [],
    });
    expect(code).toBe(0);
    const after = await countRuns();
    expect(after).toBe(before + 1);
  });

  it('apply senza --confirm non scrive', async () => {
    const before = await countRuns();
    const code = await runApply(buildRuntime(database.db), {
      command: 'apply',
      confirm: false,
      stage: null,
      only: null,
      verbose: false,
      run: null,
      forceContent: [],
    });
    expect(code).toBe(1);
    const after = await countRuns();
    expect(after).toBe(before);
  });
});
