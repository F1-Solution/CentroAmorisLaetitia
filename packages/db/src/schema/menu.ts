import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { contents } from './content.js';
import { menuItemKind, menuVisibility } from './enums.js';
import { terms } from './taxonomy.js';

/**
 * Menu. Requisiti RC-01, RC-03.
 * 1B-W0 §3: 64 voci a database, 41 rese a un anonimo.
 */

export const menus = pgTable(
  'menus',
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull(),
    label: text().notNull(),
    legacyId: bigint({ mode: 'number' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('menus_key_unique').on(t.key)],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    menuId: uuid()
      .notNull()
      .references(() => menus.id, { onDelete: 'cascade' }),
    parentId: uuid().references((): AnyPgColumn => menuItems.id, { onDelete: 'cascade' }),
    position: integer().notNull().default(0),
    kind: menuItemKind().notNull(),
    label: text().notNull(),
    contentId: uuid().references(() => contents.id, { onDelete: 'set null' }),
    termId: uuid().references(() => terms.id, { onDelete: 'set null' }),
    /** Solo per `kind = 'custom'`. */
    url: text(),
    linkTarget: text(),
    cssClasses: text(),
    /** Sostituisce nav-menu-roles. */
    visibility: menuVisibility().notNull().default('public'),
    visibleToRoles: text().array().notNull().default([]),
    legacyId: bigint({ mode: 'number' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('menu_items_legacy_unique').on(t.legacyId),
    check(
      'menu_items_target_matches_kind',
      sql`(kind = 'content' AND content_id IS NOT NULL AND term_id IS NULL AND url IS NULL) OR (kind = 'term' AND term_id IS NOT NULL AND content_id IS NULL AND url IS NULL) OR (kind = 'custom' AND url IS NOT NULL AND content_id IS NULL AND term_id IS NULL)`,
    ),
    check(
      'menu_items_roles_only_when_needed',
      sql`visibility = 'roles' OR cardinality(visible_to_roles) = 0`,
    ),
    index('menu_items_menu_idx').on(t.menuId, t.parentId, t.position),
    index('menu_items_public_idx')
      .on(t.menuId, t.position)
      .where(sql`visibility = 'public'`),
  ],
);
