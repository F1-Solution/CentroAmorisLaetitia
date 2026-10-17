import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { contentStatus, contentType, pageLayout } from './enums.js';
import { media } from './media.js';
import { tsvector } from './types.js';

/** Contenuti. Requisiti RC-01, RC-03. ADR-005. */

export const contents = pgTable(
  'contents',
  {
    id: uuid().primaryKey().defaultRandom(),
    type: contentType().notNull(),
    status: contentStatus().notNull().default('draft'),
    slug: text().notNull(),
    /** Percorso completo, per esempio `/chi-siamo/`. */
    path: text().notNull(),
    parentId: uuid().references((): AnyPgColumn => contents.id, { onDelete: 'restrict' }),
    /** Ex `menu_order`. */
    position: integer().notNull().default(0),
    title: text().notNull(),
    /** Sostituisce `shk-hide-title` e il titolo soppresso dal page builder (1B-W0 §4). */
    showTitle: boolean().notNull().default(true),
    /** Barra laterale e larghezza della colonna; predefinito del tema `et_right_sidebar` (DR-139). */
    pageLayout: pageLayout().notNull().default('right_sidebar'),
    /** Ex `_et_pb_gutter_width`; vuota = valore del tema, 2 (DR-149). */
    gutterWidth: smallint(),
    isSticky: boolean().notNull().default(false),
    excerpt: text(),
    /** Documento a blocchi (ADR-005 §3.1). */
    blocks: jsonb().notNull().default({ schema: 1, blocks: [] }),
    /** Cache di resa, rigenerata (ADR-005 §3.6). */
    contentHtml: text().notNull().default(''),
    /** Solo testo, per ricerca e description. */
    contentText: text().notNull().default(''),
    /** Inizio del testo nella forma che Divi conta per l'estratto, con le entità di `wptexturize`; vuota per i contenuti del CMS (D71, DR-155). */
    summarySource: text(),
    featuredMediaId: uuid().references(() => media.id, { onDelete: 'set null' }),
    publishedAt: timestamp({ withTimezone: true }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    legacyId: bigint({ mode: 'number' }),
    legacyType: text(),
    /** `gutenberg` | `divi` | `html` (1B-W0 §1). */
    legacyFormat: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Ricerca full-text in italiano. Colonna generata: non può divergere. */
    searchVector: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('italian', coalesce(title, '')), 'A') || setweight(to_tsvector('italian', coalesce(excerpt, '')), 'B') || setweight(to_tsvector('italian', coalesce(content_text, '')), 'C')`,
    ),
  },
  (t) => [
    unique('contents_path_unique').on(t.path),
    unique('contents_legacy_id_unique').on(t.legacyId),
    unique('contents_slug_parent_unique').on(t.parentId, t.slug),
    check('contents_published_has_date', sql`status <> 'published' OR published_at IS NOT NULL`),
    check('contents_posts_have_no_parent', sql`type <> 'post' OR parent_id IS NULL`),
    check('contents_path_shape', sql`path ~ '^/([a-z0-9._~%!$&()*+,;=:@-]+/)*$'`),
    check('contents_gutter_width_range', sql`gutter_width BETWEEN 1 AND 4`),
    check('contents_blocks_have_schema', sql`blocks ? 'schema' AND blocks ? 'blocks'`),
    index('contents_type_status_idx').on(t.type, t.status, t.publishedAt.desc().nullsFirst()),
    index('contents_parent_idx').on(t.parentId, t.position),
    index('contents_blocks_gin').using('gin', sql`blocks jsonb_path_ops`),
    index('contents_search_idx').using('gin', t.searchVector),
  ],
);

/** Cronologia. Le revisioni di WordPress non si importano (ADR-005 §3.7). */
export const contentRevisions = pgTable(
  'content_revisions',
  {
    id: uuid().primaryKey().defaultRandom(),
    contentId: uuid()
      .notNull()
      .references(() => contents.id, { onDelete: 'cascade' }),
    revisionNo: integer().notNull(),
    title: text().notNull(),
    blocks: jsonb().notNull(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    unique('content_revisions_unique').on(t.contentId, t.revisionNo),
    index('content_revisions_content_idx').on(t.contentId, t.revisionNo.desc().nullsFirst()),
  ],
);

/**
 * Copie di lavoro (DR-068). L'editor vi salva da solo; il contenuto pubblicato
 * cambia solo su comando esplicito. Per questo il criterio 1D-36 — aprire e
 * salvare senza modifiche non cambia nulla — si verifica **sul contenuto**: la
 * copia di lavoro e' un record distinto e il salvataggio automatico non tocca
 * `contents`.
 *
 * Una copia per persona e per contenuto: ADR-006 §3.2 rimanda la modifica
 * collaborativa, e una copia condivisa la introdurrebbe di fatto, facendo
 * sovrascrivere a due redattori lo stesso lavoro senza avvisarli.
 */
export const contentDrafts = pgTable(
  'content_drafts',
  {
    id: uuid().primaryKey().defaultRandom(),
    contentId: uuid()
      .notNull()
      .references(() => contents.id, { onDelete: 'cascade' }),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    excerpt: text(),
    /** Stesso documento a blocchi di `contents.blocks`, con lo stesso schema. */
    blocks: jsonb().notNull(),
    /**
     * `contents.updated_at` al momento in cui la copia e' stata aperta. Se il
     * contenuto e' cambiato sotto, pubblicare la copia sovrascriverebbe il
     * lavoro di un altro: il servizio se ne accorge confrontando i due valori.
     */
    baseUpdatedAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('content_drafts_content_author_unique').on(t.contentId, t.authorId),
    check('content_drafts_blocks_have_schema', sql`blocks ? 'schema' AND blocks ? 'blocks'`),
    index('content_drafts_author_idx').on(t.authorId, t.updatedAt.desc().nullsFirst()),
  ],
);
