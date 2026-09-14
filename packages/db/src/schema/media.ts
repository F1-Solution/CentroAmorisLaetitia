import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { bytea } from './types.js';

/** Media. Requisito RC-03, ADR-004. */

export const media = pgTable(
  'media',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Chiave nel bucket, per esempio `2017/09/logo_header_2.png`. */
    storageKey: text().notNull(),
    /** Percorso servito, per esempio `/media/2017/09/logo_header_2.png`. */
    publicPath: text().notNull(),
    fileName: text().notNull(),
    mimeType: text().notNull(),
    byteSize: bigint({ mode: 'number' }).notNull(),
    width: integer(),
    height: integer(),
    /** SHA-256: verifica di completezza dell'import. */
    checksum: bytea().notNull(),
    title: text(),
    altText: text(),
    caption: text(),
    description: text(),
    /** Bucket riservato (ADR-004 §3.6, DR-033). */
    isPrivate: boolean().notNull().default(false),
    uploadedAt: timestamp({ withTimezone: true }).notNull(),
    uploadedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    legacyId: bigint({ mode: 'number' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('media_public_path_unique').on(t.publicPath),
    unique('media_storage_key_unique').on(t.storageKey),
    unique('media_legacy_id_unique').on(t.legacyId),
    index('media_mime_idx').on(t.mimeType),
    index('media_private_idx')
      .on(t.isPrivate)
      .where(sql`is_private`),
    check('media_public_path_shape', sql`public_path LIKE '/media/%'`),
  ],
);

/** Dimensioni derivate generate a suo tempo da WordPress. Non si rigenerano (ADR-004 §3.2). */
export const mediaVariants = pgTable(
  'media_variants',
  {
    id: uuid().primaryKey().defaultRandom(),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    storageKey: text().notNull(),
    publicPath: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    byteSize: bigint({ mode: 'number' }).notNull(),
    checksum: bytea().notNull(),
  },
  (t) => [
    unique('media_variants_public_path_unique').on(t.publicPath),
    index('media_variants_media_idx').on(t.mediaId),
    check('media_variants_public_path_shape', sql`public_path LIKE '/media/%'`),
  ],
);
