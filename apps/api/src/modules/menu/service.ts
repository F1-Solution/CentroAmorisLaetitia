import { schema, type Database } from '@amoris/db';
import { asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { createItemBody, updateItemBody } from './schemas.js';

/** Servizio del dominio `menu`. */

type CreateItem = z.infer<typeof createItemBody>;
type UpdateItem = z.infer<typeof updateItemBody>;

const itemColumns = {
  id: schema.menuItems.id,
  menuId: schema.menuItems.menuId,
  parentId: schema.menuItems.parentId,
  position: schema.menuItems.position,
  kind: schema.menuItems.kind,
  label: schema.menuItems.label,
  contentId: schema.menuItems.contentId,
  termId: schema.menuItems.termId,
  url: schema.menuItems.url,
  linkTarget: schema.menuItems.linkTarget,
  cssClasses: schema.menuItems.cssClasses,
  visibility: schema.menuItems.visibility,
  visibleToRoles: schema.menuItems.visibleToRoles,
};

export function listMenus(db: Database) {
  return db
    .select({ id: schema.menus.id, key: schema.menus.key, label: schema.menus.label })
    .from(schema.menus)
    .orderBy(asc(schema.menus.key));
}

export async function findMenuByKey(db: Database, key: string) {
  const [row] = await db
    .select({ id: schema.menus.id, key: schema.menus.key, label: schema.menus.label })
    .from(schema.menus)
    .where(eq(schema.menus.key, key))
    .limit(1);
  return row ?? null;
}

export function listItems(db: Database, menuId: string) {
  return db
    .select(itemColumns)
    .from(schema.menuItems)
    .where(eq(schema.menuItems.menuId, menuId))
    .orderBy(asc(schema.menuItems.position));
}

export async function findItem(db: Database, id: string) {
  const [row] = await db
    .select(itemColumns)
    .from(schema.menuItems)
    .where(eq(schema.menuItems.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * `visibleToRoles` si svuota quando la visibilità non è `roles`: il vincolo
 * `menu_items_roles_only_when_needed` lo pretende, e lasciare ruoli appesi a una
 * voce pubblica sarebbe un permesso scritto dove nessuno lo legge.
 */
function rolesFor(
  visibility: 'public' | 'authenticated' | 'roles' | 'hidden',
  roles: readonly string[] | undefined,
): string[] {
  return visibility === 'roles' ? [...(roles ?? [])] : [];
}

export async function createItem(db: Database, menuId: string, input: CreateItem) {
  const visibility = input.visibility ?? 'public';
  const [row] = await db
    .insert(schema.menuItems)
    .values({
      menuId,
      parentId: input.parentId ?? null,
      position: input.position ?? 0,
      kind: input.kind,
      label: input.label,
      contentId: input.kind === 'content' ? input.contentId : null,
      termId: input.kind === 'term' ? input.termId : null,
      url: input.kind === 'custom' ? input.url : null,
      linkTarget: input.linkTarget ?? null,
      cssClasses: input.cssClasses ?? null,
      visibility,
      visibleToRoles: rolesFor(visibility, input.visibleToRoles),
    })
    .returning({ id: schema.menuItems.id });
  if (!row) throw new Error('voce di menu non creata');
  return row.id;
}

export async function updateItem(db: Database, id: string, input: UpdateItem) {
  const current = await findItem(db, id);
  if (!current) return null;

  const visibility = input.visibility ?? current.visibility;
  await db
    .update(schema.menuItems)
    .set({
      parentId: input.parentId === undefined ? current.parentId : (input.parentId ?? null),
      position: input.position ?? current.position,
      label: input.label ?? current.label,
      linkTarget: input.linkTarget === undefined ? current.linkTarget : input.linkTarget,
      cssClasses: input.cssClasses === undefined ? current.cssClasses : input.cssClasses,
      visibility,
      visibleToRoles: rolesFor(visibility, input.visibleToRoles ?? current.visibleToRoles),
      updatedAt: new Date(),
    })
    .where(eq(schema.menuItems.id, id));
  return findItem(db, id);
}

export async function removeItem(db: Database, id: string): Promise<boolean> {
  const rows = await db
    .delete(schema.menuItems)
    .where(eq(schema.menuItems.id, id))
    .returning({ id: schema.menuItems.id });
  return rows.length > 0;
}
