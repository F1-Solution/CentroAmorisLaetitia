import { bigint, bigserial, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

/**
 * Conservazione di dati legacy. DR-026: si importa tutto, senza bonifica.
 *
 * Queste tabelle **non alimentano alcuna funzione** della Fase 1: esistono solo
 * per non perdere dati. Contengono dati personali di terzi: rischio R-04,
 * verifica legale MI-06 prima della produzione.
 */

export const legacyEmailLog = pgTable(
  'legacy_email_log',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey(),
    occurredAt: timestamp({ withTimezone: true }),
    eventType: text(),
    payload: jsonb().notNull(),
    legacyId: bigint({ mode: 'number' }),
  },
  (t) => [unique('legacy_email_log_legacy_unique').on(t.legacyId)],
);

export const legacyDownloadStats = pgTable(
  'legacy_download_stats',
  {
    id: bigserial({ mode: 'bigint' }).primaryKey(),
    occurredAt: timestamp({ withTimezone: true }),
    payload: jsonb().notNull(),
    legacyId: bigint({ mode: 'number' }),
  },
  (t) => [unique('legacy_download_stats_legacy_unique').on(t.legacyId)],
);
