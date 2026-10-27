import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { contents } from './content.js';
import { media } from './media.js';
import { terms } from './taxonomy.js';

/**
 * SEO. Requisiti RC-04, RC-05, RC-06. 1B-W0 §2.
 * Si migrano le regole, non i 282 record (R-10).
 */

/** Template globali, uno per ambito. Sostituiscono `aioseo_options`. */
export const seoTemplates = pgTable('seo_templates', {
  /** `page`, `post`, `category`, `home`, `attachment`, `search`, `archive`. */
  scope: text().primaryKey(),
  /** Per esempio `{title} - {site_title}`. */
  titleTemplate: text().notNull(),
  descriptionTemplate: text(),
  robotsDirectives: text().array().notNull().default([]),
  ogType: text(),
  schemaType: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
});

/** Sovrascrittura per singolo contenuto (RC-04). Nasce quasi vuota, ed è corretto. */
export const contentSeo = pgTable('content_seo', {
  contentId: uuid()
    .primaryKey()
    .references(() => contents.id, { onDelete: 'cascade' }),
  title: text(),
  description: text(),
  canonicalUrl: text(),
  ogTitle: text(),
  ogDescription: text(),
  ogImageId: uuid().references(() => media.id, { onDelete: 'set null' }),
  robotsNoindex: boolean().notNull().default(false),
  robotsNofollow: boolean().notNull().default(false),
  /** `WebPage` o `BlogPosting`; vuota = quello del modello SEO (DR-278). */
  schemaType: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Come sopra, per le tassonomie. */
export const termSeo = pgTable('term_seo', {
  termId: uuid()
    .primaryKey()
    .references(() => terms.id, { onDelete: 'cascade' }),
  title: text(),
  description: text(),
  robotsNoindex: boolean().notNull().default(false),
  robotsNofollow: boolean().notNull().default(false),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
