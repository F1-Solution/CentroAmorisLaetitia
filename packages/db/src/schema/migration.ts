import {
  bigint,
  bigserial,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

/** Migrazione. Idempotenza e rieseguibilità dell'importer (1B-W4). */

export const importRuns = pgTable('import_runs', {
  id: uuid().primaryKey().defaultRandom(),
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
  isDryRun: boolean().notNull(),
  /** Per esempio `BackupDB-2026-09-13`. */
  sourceLabel: text().notNull(),
  importerVersion: text().notNull(),
  /** `success` | `partial` | `failed`. */
  outcome: text(),
  summary: jsonb().notNull().default({}),
  createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
});

/**
 * Corrispondenza fra identificatori della sorgente e del sistema nuovo.
 * È ciò che rende l'import rieseguibile senza duplicare.
 */
export const importIdMap = pgTable(
  'import_id_map',
  {
    sourceTable: text().notNull(),
    sourceId: bigint({ mode: 'number' }).notNull(),
    entity: text().notNull(),
    entityId: uuid().notNull(),
    runId: uuid().references(() => importRuns.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sourceTable, t.sourceId, t.entity] }),
    index('import_id_map_entity_idx').on(t.entity, t.entityId),
  ],
);

/** Anomalie incontrate. Sostituisce il «vedremo dopo» con un elenco. */
export const importIssues = pgTable(
  'import_issues',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey(),
    runId: uuid()
      .notNull()
      .references(() => importRuns.id, { onDelete: 'cascade' }),
    /** `info` | `warning` | `error`. */
    severity: text().notNull(),
    /** `block.fallback`, `media.missing`, … */
    category: text().notNull(),
    sourceTable: text(),
    sourceId: bigint({ mode: 'number' }),
    message: text().notNull(),
    detail: jsonb().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('import_issues_run_idx').on(t.runId, t.severity, t.category)],
);
