import { databaseNow, schema, type Database } from '@amoris/db';
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { createBody, draftBody, listQuery, updateBody } from './schemas.js';

/**
 * Servizio del dominio `content`. Nessuna rotta tocca il database: ADR-001 §3
 * punto 2, che è la condizione perché la scelta di Fastify regga.
 */

type ListQuery = z.infer<typeof listQuery>;
type CreateInput = z.infer<typeof createBody>;
type UpdateInput = z.infer<typeof updateBody>;

const summaryColumns = {
  id: schema.contents.id,
  type: schema.contents.type,
  status: schema.contents.status,
  slug: schema.contents.slug,
  path: schema.contents.path,
  title: schema.contents.title,
  position: schema.contents.position,
  parentId: schema.contents.parentId,
  publishedAt: schema.contents.publishedAt,
  updatedAt: schema.contents.updatedAt,
};

/**
 * Il percorso discende dal genitore, non si scrive a mano: è ciò che tiene
 * `contents_path_unique` e il vincolo di forma allineati all'albero.
 */
export async function pathFor(
  db: Database,
  parentId: string | null | undefined,
  slug: string,
): Promise<string> {
  if (!parentId) return `/${slug}/`;
  const [parent] = await db
    .select({ path: schema.contents.path })
    .from(schema.contents)
    .where(eq(schema.contents.id, parentId))
    .limit(1);
  if (!parent) throw Object.assign(new Error('genitore inesistente'), { statusCode: 400 });
  return `${parent.path}${slug}/`;
}

export async function list(db: Database, query: ListQuery) {
  const filters: SQL[] = [];
  if (query.type) filters.push(eq(schema.contents.type, query.type));
  if (query.status) filters.push(eq(schema.contents.status, query.status));
  if (query.search) {
    const pattern = `%${query.search}%`;
    const match = or(ilike(schema.contents.title, pattern), ilike(schema.contents.path, pattern));
    if (match) filters.push(match);
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [total] = await db.select({ value: count() }).from(schema.contents).where(where);
  const items = await db
    .select(summaryColumns)
    .from(schema.contents)
    .where(where)
    .orderBy(desc(schema.contents.updatedAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { items, total: total?.value ?? 0 };
}

export async function findById(db: Database, id: string) {
  const [row] = await db
    .select({
      ...summaryColumns,
      showTitle: schema.contents.showTitle,
      pageLayout: schema.contents.pageLayout,
      isSticky: schema.contents.isSticky,
      excerpt: schema.contents.excerpt,
      blocks: schema.contents.blocks,
      contentHtml: schema.contents.contentHtml,
      featuredMediaId: schema.contents.featuredMediaId,
      legacyFormat: schema.contents.legacyFormat,
    })
    .from(schema.contents)
    .where(eq(schema.contents.id, id))
    .limit(1);
  return row ?? null;
}

export async function create(db: Database, input: CreateInput, authorId: string) {
  const [row] = await db
    .insert(schema.contents)
    .values({
      type: input.type,
      status: 'draft',
      slug: input.slug,
      path: await pathFor(db, input.parentId ?? null, input.slug),
      parentId: input.type === 'post' ? null : (input.parentId ?? null),
      title: input.title,
      showTitle: input.showTitle ?? true,
      ...(input.pageLayout ? { pageLayout: input.pageLayout } : {}),
      excerpt: input.excerpt ?? null,
      blocks: input.blocks ?? { schema: 1, blocks: [] },
      authorId,
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('contenuto non creato');
  return row.id;
}

export async function update(db: Database, id: string, input: UpdateInput) {
  const current = await findById(db, id);
  if (!current) return null;

  const slug = input.slug ?? current.slug;
  const parentId = input.parentId === undefined ? current.parentId : (input.parentId ?? null);

  // DR-091: l'ora del database, la stessa con cui l'importer registra la fine di un'esecuzione.
  const changes: Record<string, unknown> = { updatedAt: databaseNow() };
  if (input.title !== undefined) changes.title = input.title;
  if (input.excerpt !== undefined) changes.excerpt = input.excerpt;
  if (input.showTitle !== undefined) changes.showTitle = input.showTitle;
  if (input.pageLayout !== undefined) changes.pageLayout = input.pageLayout;
  if (input.isSticky !== undefined) changes.isSticky = input.isSticky;
  if (input.featuredMediaId !== undefined) changes.featuredMediaId = input.featuredMediaId;
  if (input.blocks !== undefined) changes.blocks = input.blocks;
  if (input.contentHtml !== undefined) changes.contentHtml = input.contentHtml;
  if (input.contentText !== undefined) {
    changes.contentText = input.contentText;
    // Il testo cambiato dal CMS (spazi esclusi) si conta com'è: la forma della sorgente non vale più (D71, DR-155).
    changes.summarySource = sql`case when regexp_replace(${schema.contents.contentText}, '\\s+', ' ', 'g') is distinct from regexp_replace(${input.contentText}, '\\s+', ' ', 'g') then null else ${schema.contents.summarySource} end`;
  }
  if (input.slug !== undefined || input.parentId !== undefined) {
    changes.slug = slug;
    changes.parentId = parentId;
    changes.path = await pathFor(db, parentId, slug);
  }

  await db.update(schema.contents).set(changes).where(eq(schema.contents.id, id));
  return findById(db, id);
}

/** Pubblicazione e ritiro sono due stati, non due campi: il vincolo di schema lo impone. */
export async function setPublication(db: Database, id: string, published: boolean) {
  const current = await findById(db, id);
  if (!current) return null;

  await db
    .update(schema.contents)
    .set(
      published
        ? {
            status: 'published',
            publishedAt: current.publishedAt ?? new Date(),
            updatedAt: databaseNow(),
          }
        : { status: 'draft', updatedAt: databaseNow() },
    )
    .where(eq(schema.contents.id, id));
  return findById(db, id);
}

export async function remove(db: Database, id: string): Promise<boolean> {
  const [child] = await db
    .select({ value: count() })
    .from(schema.contents)
    .where(eq(schema.contents.parentId, id));
  if ((child?.value ?? 0) > 0) {
    throw Object.assign(new Error('il contenuto ha figli e non si elimina'), { statusCode: 409 });
  }
  const rows = await db
    .delete(schema.contents)
    .where(eq(schema.contents.id, id))
    .returning({ id: schema.contents.id });
  return rows.length > 0;
}

/** Elenco dei termini legati a un contenuto: serve all'elenco e all'editor. */
export function termsOf(db: Database, contentId: string) {
  return db
    .select({ id: schema.terms.id, slug: schema.terms.slug, name: schema.terms.name })
    .from(schema.contentTerms)
    .innerJoin(schema.terms, eq(schema.terms.id, schema.contentTerms.termId))
    .where(eq(schema.contentTerms.contentId, contentId))
    .orderBy(sql`${schema.contentTerms.position}`);
}

type DraftInput = z.infer<typeof draftBody>;

/** La transazione è ammessa perché una prova possa fissare l'ora del database (DR-091). */
type DatabaseOrTx = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Salva la copia di lavoro della persona su quel contenuto (DR-068). Una copia
 * per persona e per contenuto: ADR-006 §3.2 rimanda la modifica collaborativa,
 * e una copia condivisa la introdurrebbe di fatto.
 *
 * **Non tocca `contents`.** E' la ragione per cui il criterio 1D-36 — aprire e
 * salvare senza modifiche non cambia nulla — resta vero: il salvataggio
 * automatico scrive qui, e il contenuto cambia solo su comando esplicito.
 */
export async function saveDraft(
  db: DatabaseOrTx,
  contentId: string,
  authorId: string,
  input: DraftInput,
) {
  const values = {
    contentId,
    authorId,
    title: input.title,
    excerpt: input.excerpt ?? null,
    blocks: input.blocks,
    baseUpdatedAt: new Date(input.baseUpdatedAt),
    updatedAt: databaseNow(),
  };
  const [row] = await db
    .insert(schema.contentDrafts)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.contentDrafts.contentId, schema.contentDrafts.authorId],
      set: {
        title: values.title,
        excerpt: values.excerpt,
        blocks: values.blocks,
        baseUpdatedAt: values.baseUpdatedAt,
        updatedAt: values.updatedAt,
      },
    })
    .returning();
  return row;
}

export async function findDraft(db: Database, contentId: string, authorId: string) {
  const [row] = await db
    .select({
      contentId: schema.contentDrafts.contentId,
      title: schema.contentDrafts.title,
      excerpt: schema.contentDrafts.excerpt,
      blocks: schema.contentDrafts.blocks,
      baseUpdatedAt: schema.contentDrafts.baseUpdatedAt,
      updatedAt: schema.contentDrafts.updatedAt,
      contentUpdatedAt: schema.contents.updatedAt,
    })
    .from(schema.contentDrafts)
    .innerJoin(schema.contents, eq(schema.contents.id, schema.contentDrafts.contentId))
    .where(
      and(
        eq(schema.contentDrafts.contentId, contentId),
        eq(schema.contentDrafts.authorId, authorId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Elimina la copia di lavoro. Avviene in tre casi, e sono i soli: quando la
 * persona la scarta, quando il suo contenuto viene eliminato (la chiave esterna
 * lo fa in cascata) e quando la copia viene riversata nel contenuto. Non esiste
 * scadenza automatica: cancellare il lavoro di qualcuno a tempo e' una regola
 * di conservazione, e quelle richiedono la verifica di MI-06.
 */
export async function discardDraft(
  db: Database,
  contentId: string,
  authorId: string,
): Promise<boolean> {
  const rows = await db
    .delete(schema.contentDrafts)
    .where(
      and(
        eq(schema.contentDrafts.contentId, contentId),
        eq(schema.contentDrafts.authorId, authorId),
      ),
    )
    .returning({ id: schema.contentDrafts.id });
  return rows.length > 0;
}
