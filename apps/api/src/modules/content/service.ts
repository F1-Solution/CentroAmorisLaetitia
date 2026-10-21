import { databaseNow, schema, type Database } from '@amoris/db';
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import { newContentPath, withPathLock } from './address.js';
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

/** Il percorso discende dal genitore e si calcola sotto lo stesso blocco del cambio d'indirizzo. */
export async function create(db: Database, input: CreateInput, authorId: string) {
  const target = { slug: input.slug, parentId: input.parentId ?? null };
  return withPathLock(db, async (tx) => {
    const [row] = await tx
      .insert(schema.contents)
      .values({
        type: input.type,
        status: 'draft',
        slug: input.slug,
        path: await newContentPath(tx, input.type, target),
        parentId: target.parentId,
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
  });
}

/** Un contenuto con titolo non può perderlo; la home importata senza titolo resta salvabile (DR-201). */
export function assertTitleAllowed(next: string | undefined, current: string): void {
  if (next !== undefined && next.trim() === '' && current.trim() !== '')
    throw Object.assign(new Error('il titolo non può essere vuoto'), { statusCode: 400 });
}

export async function update(db: Database, id: string, input: UpdateInput) {
  const current = await findById(db, id);
  if (!current) return null;
  assertTitleAllowed(input.title, current.title);

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
  if (input.contentText !== undefined || input.excerpt !== undefined) {
    // Estratto o testo cambiati dal CMS: la description calcolata all'import non vale più (DR-180).
    const textChanged =
      input.contentText === undefined
        ? sql`false`
        : sql`regexp_replace(${schema.contents.contentText}, '\\s+', ' ', 'g') is distinct from regexp_replace(${input.contentText}, '\\s+', ' ', 'g')`;
    const excerptChanged =
      input.excerpt === undefined
        ? sql`false`
        : sql`${schema.contents.excerpt} is distinct from ${input.excerpt}::text`;
    changes.descriptionSource = sql`case when ${textChanged} or ${excerptChanged} then null else ${schema.contents.descriptionSource} end`;
  }
  // Blocchi senza testo: il testo non si può confrontare, la description importata non vale più.
  if (input.blocks !== undefined && input.contentText === undefined)
    changes.descriptionSource = null;

  // DR-186: la data di modifica cambia solo se cambia un campo, non a un salvataggio identico (1E-19).
  const differs = changedFields(input);
  changes.modifiedAt =
    differs.length === 0
      ? sql`${schema.contents.modifiedAt}`
      : sql`case when ${sql.join(differs, sql` or `)} then ${databaseNow()} else ${schema.contents.modifiedAt} end`;

  await db.update(schema.contents).set(changes).where(eq(schema.contents.id, id));
  return findById(db, id);
}

/** Le condizioni «il valore inviato è diverso da quello salvato», una per campo inviato. */
function changedFields(input: UpdateInput): SQL[] {
  const c = schema.contents;
  const differs: SQL[] = [];
  const add = (sent: unknown, condition: SQL) => {
    if (sent !== undefined) differs.push(condition);
  };
  add(input.title, sql`${c.title} is distinct from ${input.title ?? null}::text`);
  add(input.excerpt, sql`${c.excerpt} is distinct from ${input.excerpt ?? null}::text`);
  add(input.showTitle, sql`${c.showTitle} is distinct from ${input.showTitle ?? null}::boolean`);
  add(
    input.pageLayout,
    sql`${c.pageLayout}::text is distinct from ${input.pageLayout ?? null}::text`,
  );
  add(input.isSticky, sql`${c.isSticky} is distinct from ${input.isSticky ?? null}::boolean`);
  add(
    input.featuredMediaId,
    sql`${c.featuredMediaId} is distinct from ${input.featuredMediaId ?? null}::uuid`,
  );
  add(
    input.blocks,
    sql`${c.blocks} is distinct from ${JSON.stringify(input.blocks ?? null)}::jsonb`,
  );
  add(
    input.contentText,
    sql`regexp_replace(${c.contentText}, '\\s+', ' ', 'g') is distinct from regexp_replace(${input.contentText ?? null}::text, '\\s+', ' ', 'g')`,
  );
  return differs;
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
