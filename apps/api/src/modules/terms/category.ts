import type { AddressPlan } from '@amoris/contracts';
import { schema, type Database } from '@amoris/db';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import {
  planMoveRedirects,
  touchesExistingRules,
  withPathLock,
  writeMoveRedirects,
  type Executor,
  type Move,
  type Transaction,
} from '../content/address.js';
import type { termDeletionSchema, termSeoBody, updateBody } from './schemas.js';

/**
 * Categorie complete (DR-280, D176=C): genitrice con indirizzo dell'archivio che ne
 * discende e redirect 301 automatici come per i contenuti (1G-11), SEO dell'archivio
 * ed eliminazione con rifiuto spiegato. Ogni scrittura dei percorsi passa sotto il
 * blocco dei percorsi dei contenuti, perché i redirect sono gli stessi.
 */

const t = schema.terms;
const CATEGORY = 'category';

type TermDeletion = z.infer<typeof termDeletionSchema>;
type TermSeoInput = z.infer<typeof termSeoBody>;
type UpdateInput = z.infer<typeof updateBody>;
export type CategoryWarnings = AddressPlan['warnings'];

function categoryError(statusCode: 400 | 403 | 409, code: string, message: string): Error {
  return Object.assign(new Error(message), { statusCode, code });
}

const invalidParent = (message: string) => categoryError(400, 'TERM_PARENT_INVALID', message);
const hasChildren = (message: string) => categoryError(409, 'TERM_HAS_CHILDREN', message);
// Come `requirePermission`: il messaggio non dice quale permesso manchi.
const notAuthorized = () => categoryError(403, 'NOT_AUTHORIZED', 'Operazione non consentita.');

/** Ordine dei byte, come per i percorsi dei contenuti. */
const byPath = () => sql`${t.path} collate "C"`;

interface PgError {
  readonly code?: unknown;
  readonly constraint_name?: unknown;
}

/** Una chiave esterna violata da una scrittura concorrente come rifiuto in italiano; `null` per il resto. */
function foreignKeyError(caught: unknown): Error | null {
  const pg = (caught instanceof Error && caught.cause ? caught.cause : caught) as PgError | null;
  if (typeof pg !== 'object' || pg === null || pg.code !== '23503') return null;
  if (pg.constraint_name !== 'terms_parent_id_terms_id_fk') return null;
  // In inserimento manca la genitrice; in eliminazione è nata una figlia.
  return invalidParent('La categoria scelta come genitrice non esiste più: ricarica e riprova.');
}

/** `withPathLock` con le chiavi esterne delle categorie tradotte. */
async function underPathLock<T>(db: Database, run: (tx: Transaction) => Promise<T>): Promise<T> {
  try {
    return await withPathLock(db, run);
  } catch (caught) {
    throw foreignKeyError(caught) ?? caught;
  }
}

async function findCategory(exec: Executor, id: string) {
  const [row] = await exec
    .select({ id: t.id, name: t.name, slug: t.slug, path: t.path, taxonomy: t.taxonomy })
    .from(t)
    .where(eq(t.id, id))
    .limit(1);
  return row?.taxonomy === CATEGORY ? row : null;
}

/**
 * Il percorso sotto cui va la categoria: `/category/` al primo livello, altrimenti
 * quello della genitrice, che non può essere la categoria stessa né una sua discendente.
 */
async function categoryParentPath(
  exec: Executor,
  parentId: string | null,
  self: { readonly id: string; readonly path: string } | null,
): Promise<string> {
  if (parentId === null) return `/${CATEGORY}/`;
  if (self && parentId === self.id) {
    throw invalidParent('Una categoria non può essere la genitrice di sé stessa.');
  }
  const [parent] = await exec
    .select({ path: t.path, taxonomy: t.taxonomy })
    .from(t)
    .where(eq(t.id, parentId))
    .limit(1);
  if (!parent) throw invalidParent('La categoria scelta come genitrice non esiste.');
  if (parent.taxonomy !== CATEGORY) {
    throw invalidParent('La genitrice deve essere una categoria delle notizie.');
  }
  if (self && parent.path.startsWith(self.path)) {
    throw invalidParent('La categoria scelta come genitrice sta sotto questa categoria.');
  }
  return parent.path;
}

export interface NewCategory {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly position: number;
}

/** Crea la categoria sotto il blocco dei percorsi, leggendo la genitrice nella stessa transazione. */
export function createCategory(db: Database, input: NewCategory): Promise<string> {
  return underPathLock(db, async (tx) => {
    const parentPath = await categoryParentPath(tx, input.parentId, null);
    const [row] = await tx
      .insert(t)
      .values({ taxonomy: CATEGORY, ...input, path: `${parentPath}${input.slug}/` })
      .returning({ id: t.id });
    if (!row) throw new Error('categoria non creata');
    return row.id;
  });
}

/** La categoria e le discendenti, col percorso nuovo; gli archivi sono tutti pubblici. */
async function movesOf(tx: Transaction, from: string, to: string): Promise<Move[]> {
  const rows = await tx
    .select({ id: t.id, name: t.name, path: t.path })
    .from(t)
    .where(and(eq(t.taxonomy, CATEGORY), sql`starts_with(${t.path}, ${from})`))
    .orderBy(byPath())
    .for('update');
  return rows.map((row) => ({
    id: row.id,
    title: row.name,
    from: row.path,
    to: to + row.path.slice(from.length),
    published: true,
  }));
}

interface Locked {
  readonly id: string;
  readonly slug: string;
  readonly path: string;
}

/**
 * Sposta la categoria sotto `parentId`: percorsi del sottoalbero, redirect 301 automatici,
 * nessuna catena né ciclo. Un archivio è pubblico, quindi serve `content.publish`; toccare
 * regole esistenti chiede anche `settings.write` (DR-242, DR-246).
 */
async function moveLocked(
  tx: Transaction,
  current: Locked,
  parentId: string | null,
  permissions: ReadonlySet<string>,
): Promise<CategoryWarnings> {
  const path = `${await categoryParentPath(tx, parentId, current)}${current.slug}/`;
  if (path === current.path) {
    await tx.update(t).set({ parentId }).where(eq(t.id, current.id));
    return [];
  }
  if (!permissions.has(PERMISSIONS.contentPublish)) throw notAuthorized();
  const moves = await movesOf(tx, current.path, path);
  const plan: AddressPlan = { path, moves, ...(await planMoveRedirects(tx, moves)) };
  if (touchesExistingRules(plan) && !permissions.has(PERMISSIONS.settingsWrite)) {
    throw notAuthorized();
  }
  await writeMoveRedirects(tx, plan, async () => {
    await tx
      .update(t)
      .set({
        path: sql`${path}::text || substr(${t.path}, ${current.path.length + 1}::int)`,
        updatedAt: new Date(),
      })
      .where(and(eq(t.taxonomy, CATEGORY), sql`starts_with(${t.path}, ${current.path})`));
    await tx.update(t).set({ parentId }).where(eq(t.id, current.id));
  });
  return plan.warnings;
}

/**
 * Nome, descrizione e genitrice in una sola transazione: un rifiuto dello spostamento
 * non lascia scritto il nome. Restituisce gli avvisi D132-A, o `null` se la categoria non c'è.
 */
export function updateCategory(
  db: Database,
  id: string,
  input: UpdateInput,
  permissions: ReadonlySet<string>,
): Promise<CategoryWarnings | null> {
  return underPathLock(db, async (tx) => {
    const [current] = await tx
      .select({
        id: t.id,
        slug: t.slug,
        path: t.path,
        taxonomy: t.taxonomy,
        name: t.name,
        description: t.description,
      })
      .from(t)
      .where(eq(t.id, id))
      .for('update');
    if (current?.taxonomy !== CATEGORY) return null;
    const warnings =
      input.parentId === undefined
        ? []
        : await moveLocked(tx, current, input.parentId, permissions);
    if (input.name !== undefined || input.description !== undefined) {
      await tx
        .update(t)
        .set({
          name: input.name ?? current.name,
          description: input.description === undefined ? current.description : input.description,
          updatedAt: new Date(),
        })
        .where(eq(t.id, id));
    }
    return warnings;
  });
}

/** Che cosa impedisce l'eliminazione; `null` se la categoria non c'è. */
export async function categoryDeletion(exec: Executor, id: string): Promise<TermDeletion | null> {
  const category = await findCategory(exec, id);
  if (!category) return null;
  const [used] = await exec
    .select({ value: count() })
    .from(schema.contentTerms)
    .where(eq(schema.contentTerms.termId, id));
  const children = await exec
    .select({ id: t.id, name: t.name, path: t.path })
    .from(t)
    .where(eq(t.parentId, id))
    .orderBy(byPath());
  const menuItems = await exec
    .select({ id: schema.menuItems.id, label: schema.menuItems.label, menu: schema.menus.label })
    .from(schema.menuItems)
    .innerJoin(schema.menus, eq(schema.menus.id, schema.menuItems.menuId))
    .where(eq(schema.menuItems.termId, id))
    .orderBy(asc(schema.menus.label), asc(schema.menuItems.label));
  const redirects = await exec
    .select({ source: schema.redirects.sourcePath })
    .from(schema.redirects)
    .where(eq(schema.redirects.targetPath, category.path))
    .orderBy(sql`${schema.redirects.sourcePath} collate "C"`);
  const contentCount = used?.value ?? 0;
  return {
    blocked: contentCount > 0 || children.length > 0 || menuItems.length > 0,
    contentCount,
    children,
    menuItems,
    redirectsToPath: redirects,
  };
}

const listOf = (names: readonly string[]): string => names.map((name) => `«${name}»`).join(', ');

function assertDeletable(preview: TermDeletion): void {
  if (preview.contentCount > 0) {
    const notizie = preview.contentCount === 1 ? '1 notizia' : `${preview.contentCount} notizie`;
    throw categoryError(
      409,
      'TERM_HAS_CONTENTS',
      `La categoria ha ${notizie}, bozze comprese: assegnale prima a un’altra categoria.`,
    );
  }
  if (preview.children.length > 0) {
    throw hasChildren(
      `La categoria ha delle sottocategorie: ${listOf(preview.children.map((c) => c.name))}. Spostale o eliminale prima.`,
    );
  }
  if (preview.menuItems.length > 0) {
    const items = preview.menuItems.map((item) => `«${item.label}» (menu «${item.menu}»)`);
    throw categoryError(
      409,
      'TERM_IN_MENU',
      `La categoria è in un menu: ${items.join(', ')}. Togli prima le voci dal menu.`,
    );
  }
}

/**
 * Elimina la categoria se nulla la trattiene; l'archivio è pubblico, quindi serve
 * `content.publish` (DR-246). Le regole verso l'archivio restano, come per i contenuti (D143-A).
 */
export async function removeCategory(
  db: Database,
  id: string,
  permissions: ReadonlySet<string>,
): Promise<{ name: string; path: string } | null> {
  try {
    return await withPathLock(db, async (tx) => {
      const [category] = await tx
        .select({ name: t.name, path: t.path, taxonomy: t.taxonomy })
        .from(t)
        .where(eq(t.id, id))
        .for('update');
      if (category?.taxonomy !== CATEGORY) return null;
      if (!permissions.has(PERMISSIONS.contentPublish)) throw notAuthorized();
      const preview = await categoryDeletion(tx, id);
      if (!preview) return null;
      assertDeletable(preview);
      await tx.delete(t).where(eq(t.id, id));
      return { name: category.name, path: category.path };
    });
  } catch (caught) {
    // Una figlia nata fra il controllo e l'eliminazione (chiave esterna `restrict`).
    if (foreignKeyError(caught)) {
      throw hasChildren('Nel frattempo è nata una sottocategoria: ricarica e riprova.');
    }
    throw caught;
  }
}

export async function isCategory(db: Database, id: string): Promise<boolean> {
  return (await findCategory(db, id)) !== null;
}

type TermSeoRow = typeof schema.termSeo.$inferSelect;

function termSeoOf(termId: string, row: TermSeoRow | undefined) {
  return {
    termId,
    title: row?.title ?? null,
    description: row?.description ?? null,
    robotsNoindex: row?.robotsNoindex ?? false,
    robotsNofollow: row?.robotsNofollow ?? false,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

export async function findTermSeo(exec: Executor, termId: string) {
  const [row] = await exec
    .select()
    .from(schema.termSeo)
    .where(eq(schema.termSeo.termId, termId))
    .limit(1);
  return termSeoOf(termId, row);
}

/** Scrive la SEO con la categoria bloccata: eliminata nel frattempo, `null` (404) e non un 500. */
export function upsertTermSeo(db: Database, termId: string, input: TermSeoInput) {
  return db.transaction(async (tx) => {
    const [category] = await tx
      .select({ taxonomy: t.taxonomy })
      .from(t)
      .where(eq(t.id, termId))
      .for('update');
    if (category?.taxonomy !== CATEGORY) return null;
    const current = await findTermSeo(tx, termId);
    const values = {
      termId,
      title: input.title === undefined ? current.title : input.title,
      description: input.description === undefined ? current.description : input.description,
      robotsNoindex: input.robotsNoindex ?? current.robotsNoindex,
      robotsNofollow: input.robotsNofollow ?? current.robotsNofollow,
      updatedAt: new Date(),
    };
    const [row] = await tx
      .insert(schema.termSeo)
      .values(values)
      .onConflictDoUpdate({ target: schema.termSeo.termId, set: values })
      .returning();
    return termSeoOf(termId, row);
  });
}
