/**
 * Database di prova reale per i test di integrazione delle fasi
 * (`docs/migration/importer-spec.md` §11). Stesso schema di
 * `tests/unit/planNoWrite.test.ts`: un database usa e getta per processo di
 * test, con le migrazioni vere applicate.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createDatabase, type Database } from '@amoris/db';

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

export interface TestDatabase {
  readonly db: Database;
  teardown(): Promise<void>;
}

export async function createTestDatabase(namePrefix: string): Promise<TestDatabase> {
  const name = `${namePrefix}_${process.pid}_${Date.now()}`;
  const admin = postgres(urlForDatabase('postgres'), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);

  const migrationClient = postgres(urlForDatabase(name), { max: 1, onnotice: () => {} });
  await migrate(drizzle(migrationClient), { migrationsFolder });
  await migrationClient.end({ timeout: 5 });

  const database = createDatabase({ url: urlForDatabase(name) });

  return {
    db: database.db,
    async teardown() {
      await database.close();
      await admin.unsafe(`drop database if exists "${name}" with (force)`);
      await admin.end({ timeout: 5 });
    },
  };
}
