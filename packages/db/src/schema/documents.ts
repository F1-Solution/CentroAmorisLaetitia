import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { media } from './media.js';
import { terms } from './taxonomy.js';

/** Documenti scaricabili e carosello. Parità (1A §2.2, §2.3), DR-033. */

/** I moduli di consulenza, oggi serviti all'indirizzo `/download/<slug>/`. */
export const documents = pgTable(
  'documents',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    title: text().notNull(),
    description: text(),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: 'restrict' }),
    /**
     * Falso per i moduli pubblici; vero per i 4 file riservati che DR-033 vuole
     * conservati per la futura area riservata e **non** raggiungibili adesso.
     */
    isPrivate: boolean().notNull().default(false),
    downloadCount: bigint({ mode: 'number' }).notNull().default(0),
    legacyId: bigint({ mode: 'number' }),
    /** `wpdmpro` | `cuar_private_file`. */
    legacySource: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('documents_slug_unique').on(t.slug),
    unique('documents_legacy_unique').on(t.legacySource, t.legacyId),
  ],
);

export const documentTerms = pgTable(
  'document_terms',
  {
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    termId: uuid()
      .notNull()
      .references(() => terms.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.termId] })],
);

/** Un solo carosello, 12 slide (1B-W0 §6). La libreria non si porta: si ricostruisce. */
export const sliders = pgTable(
  'sliders',
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull(),
    title: text().notNull(),
    settings: jsonb().notNull().default({}),
    legacyId: bigint({ mode: 'number' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('sliders_key_unique').on(t.key)],
);

export const sliderSlides = pgTable(
  'slider_slides',
  {
    id: uuid().primaryKey().defaultRandom(),
    sliderId: uuid()
      .notNull()
      .references(() => sliders.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    mediaId: uuid().references(() => media.id, { onDelete: 'set null' }),
    heading: text(),
    body: text(),
    linkUrl: text(),
    linkLabel: text(),
    settings: jsonb().notNull().default({}),
    legacyId: bigint({ mode: 'number' }),
  },
  (t) => [unique('slider_slides_position_unique').on(t.sliderId, t.position)],
);
