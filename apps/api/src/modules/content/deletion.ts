import type { DeletionPreview } from '@amoris/contracts';
import { schema, type Database } from '@amoris/db';
import { asc, eq, sql } from 'drizzle-orm';
import { PERMISSIONS } from '../../auth/permissions.js';
import { homeContentId } from '../public/service.js';
import { withPathLock, type Executor } from './address.js';

/**
 * Eliminazione di un contenuto (wave 1G-W4, S8, D142-A, D143-A): l'anteprima e la
 * scrittura calcolano gli impedimenti con la stessa funzione; la scrittura li
 * ricalcola dentro la propria transazione, sotto il blocco dei percorsi.
 */

export interface RemovedContent {
  readonly title: string;
  readonly path: string;
  readonly type: 'page' | 'post';
}

const c = schema.contents;

function deletionError(code: string, message: string, statusCode: 403 | 409): Error {
  return Object.assign(new Error(message), { statusCode, code });
}

/** Ordine dei byte, come per i percorsi: l'elenco non dipende dalla collazione del database. */
const byPath = () => sql`${c.path} collate "C"`;

/** Che cosa impedisce l'eliminazione e che cosa resta puntato al contenuto; `null` se non esiste. */
export async function deletionBlockers(
  exec: Executor,
  id: string,
): Promise<DeletionPreview | null> {
  const [content] = await exec.select({ path: c.path }).from(c).where(eq(c.id, id)).limit(1);
  if (!content) return null;

  const children = await exec
    .select({ id: c.id, title: c.title, path: c.path })
    .from(c)
    .where(eq(c.parentId, id))
    .orderBy(byPath());
  const menuItems = await exec
    .select({ id: schema.menuItems.id, label: schema.menuItems.label, menu: schema.menus.label })
    .from(schema.menuItems)
    .innerJoin(schema.menus, eq(schema.menus.id, schema.menuItems.menuId))
    .where(eq(schema.menuItems.contentId, id))
    .orderBy(asc(schema.menus.label), asc(schema.menuItems.label));
  const redirects = await exec
    .select({ source: schema.redirects.sourcePath })
    .from(schema.redirects)
    .where(eq(schema.redirects.targetPath, content.path))
    .orderBy(sql`${schema.redirects.sourcePath} collate "C"`);
  const isHome = (await homeContentId(exec)) === id;

  return {
    blocked: children.length > 0 || menuItems.length > 0 || isHome,
    // Il titolo può mancare per scelta (home importata): si ripiega sul percorso.
    children: children.map((child) => ({ ...child, title: child.title || child.path })),
    menuItems,
    isHome,
    redirectsToPath: redirects,
  };
}

const listOf = (names: readonly string[]): string => names.map((name) => `«${name}»`).join(', ');

/** Il primo impedimento, con un messaggio che nomina figlie, voci e menu o la pagina iniziale. */
function assertDeletable(preview: DeletionPreview): void {
  if (preview.children.length > 0) {
    throw deletionError(
      'CONTENT_HAS_CHILDREN',
      `Il contenuto ha pagine figlie: ${listOf(preview.children.map((child) => child.title))}. Spostale o eliminale prima.`,
      409,
    );
  }
  if (preview.menuItems.length > 0) {
    const items = preview.menuItems.map((item) => `«${item.label}» (menu «${item.menu}»)`);
    throw deletionError(
      'CONTENT_IN_MENU',
      `Il contenuto è in un menu: ${items.join(', ')}. Togli prima le voci dal menu.`,
      409,
    );
  }
  if (preview.isHome) {
    throw deletionError(
      'CONTENT_IS_HOME',
      'Il contenuto è la pagina iniziale del sito: scegli prima un’altra pagina iniziale.',
      409,
    );
  }
}

/**
 * Elimina il contenuto in transazione, sotto il blocco dei percorsi, e restituisce ciò che
 * il registro ricorda, o `null` se il contenuto non c'è.
 */
export function removeContent(
  db: Database,
  id: string,
  permissions: ReadonlySet<string>,
): Promise<RemovedContent | null> {
  return withPathLock(db, async (tx) => {
    const [content] = await tx
      .select({ title: c.title, path: c.path, type: c.type, status: c.status })
      .from(c)
      .where(eq(c.id, id))
      .for('update')
      .limit(1);
    if (!content) return null;
    // D142-A: eliminare un contenuto pubblicato chiede anche `content.publish`, come spostarlo (DR-242).
    if (content.status === 'published' && !permissions.has(PERMISSIONS.contentPublish)) {
      // Il messaggio generico di `requirePermission` (plugins/auth.ts): non dice quale permesso manchi.
      throw deletionError('NOT_AUTHORIZED', 'Operazione non consentita.', 403);
    }
    const preview = await deletionBlockers(tx, id);
    if (!preview) return null;
    assertDeletable(preview);
    await tx.delete(c).where(eq(c.id, id));
    return { title: content.title || content.path, path: content.path, type: content.type };
  });
}
