import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { redirectKind, redirectOrigin } from './enums.js';

/**
 * Redirect. Requisito RC-07, DR-034, R-09.
 * ADR-003 §3.5: sono **dati**, non configurazione del reverse proxy, così che
 * restino modificabili dal CMS.
 *
 * Contenuto atteso dopo l'import della Fase 1D: 169 righe `exact` dalle pagine
 * allegato, 4 dai download, 6 dagli slug storici, 1 riga `prefix` per i percorsi
 * storici dei media. In totale 180.
 */
export const redirects = pgTable(
  'redirects',
  {
    id: uuid().primaryKey().defaultRandom(),
    sourcePath: text().notNull(),
    targetPath: text().notNull(),
    statusCode: smallint().notNull().default(301),
    kind: redirectKind().notNull().default('exact'),
    origin: redirectOrigin().notNull().default('manual'),
    isActive: boolean().notNull().default(true),
    note: text(),
    hitCount: bigint({ mode: 'number' }).notNull().default(0),
    lastHitAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('redirects_source_unique').on(t.sourcePath),
    check('redirects_status_valid', sql`status_code IN (301, 302, 307, 308)`),
    check('redirects_no_self_loop', sql`source_path <> target_path`),
    index('redirects_active_idx')
      .on(t.sourcePath)
      .where(sql`is_active`),
  ],
);
