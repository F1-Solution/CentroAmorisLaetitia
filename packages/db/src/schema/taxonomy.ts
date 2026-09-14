import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { contents } from './content.js';

/**
 * Tassonomie. Requisiti RC-01, RC-03.
 * Nella sorgente: 2 categorie, 0 tag. La struttura resta generica perché costa
 * niente e i tag possono servire domani.
 */

export const terms = pgTable(
  'terms',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** `category` | `tag`. */
    taxonomy: text().notNull(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    parentId: uuid().references((): AnyPgColumn => terms.id, { onDelete: 'restrict' }),
    position: integer().notNull().default(0),
    /** Per esempio `/category/news/`. */
    path: text().notNull(),
    legacyId: bigint({ mode: 'number' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('terms_taxonomy_slug_unique').on(t.taxonomy, t.slug),
    unique('terms_path_unique').on(t.path),
    unique('terms_legacy_unique').on(t.taxonomy, t.legacyId),
    check('terms_path_shape', sql`path ~ '^/([a-z0-9._~%!$&()*+,;=:@-]+/)*$'`),
  ],
);

export const contentTerms = pgTable(
  'content_terms',
  {
    contentId: uuid()
      .notNull()
      .references(() => contents.id, { onDelete: 'cascade' }),
    termId: uuid()
      .notNull()
      .references(() => terms.id, { onDelete: 'cascade' }),
    position: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.contentId, t.termId] }),
    index('content_terms_term_idx').on(t.termId),
  ],
);
