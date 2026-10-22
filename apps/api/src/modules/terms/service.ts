import { schema, type Database } from '@amoris/db';
import { asc, count, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { createBody, updateBody } from './schemas.js';

/** Servizio del dominio `terms`. Le rotte non toccano il database (ADR-001 §3 punto 2). */

type CreateInput = z.infer<typeof createBody>;
type UpdateInput = z.infer<typeof updateBody>;

const columns = {
  id: schema.terms.id,
  taxonomy: schema.terms.taxonomy,
  slug: schema.terms.slug,
  name: schema.terms.name,
  description: schema.terms.description,
  parentId: schema.terms.parentId,
  position: schema.terms.position,
  path: schema.terms.path,
  // Notizie legate, in qualunque stato (S5).
  contentCount:
    sql<number>`(select count(*)::int from ${schema.contentTerms} where ${schema.contentTerms.termId} = ${schema.terms.id})`.mapWith(
      Number,
    ),
};

function termError(statusCode: 400 | 409, code: string, message: string): Error {
  return Object.assign(new Error(message), { statusCode, code });
}

const slugTaken = () =>
  termError(
    409,
    'TERM_SLUG_TAKEN',
    'Esiste già un termine con questo indirizzo: scegline un altro.',
  );

/** Una violazione d'unicità di slug o percorso come 409; `null` per ogni altro errore. */
function conflictFrom(caught: unknown): Error | null {
  const pg = (caught instanceof Error && caught.cause ? caught.cause : caught) as {
    code?: unknown;
  } | null;
  return typeof pg === 'object' && pg !== null && pg.code === '23505' ? slugTaken() : null;
}

/**
 * Come per i contenuti, il percorso discende dal genitore e dalla tassonomia:
 * `/category/news/`, non un testo scritto a mano.
 */
async function pathFor(
  db: Database,
  taxonomy: string,
  parentId: string | null | undefined,
  slug: string,
): Promise<string> {
  if (!parentId) return `/${taxonomy}/${slug}/`;
  const [parent] = await db
    .select({ path: schema.terms.path })
    .from(schema.terms)
    .where(eq(schema.terms.id, parentId))
    .limit(1);
  if (!parent) throw Object.assign(new Error('genitore inesistente'), { statusCode: 400 });
  return `${parent.path}${slug}/`;
}

export function list(db: Database, taxonomy?: string) {
  const query = db.select(columns).from(schema.terms);
  return taxonomy
    ? query.where(eq(schema.terms.taxonomy, taxonomy)).orderBy(asc(schema.terms.position))
    : query.orderBy(asc(schema.terms.taxonomy), asc(schema.terms.position));
}

export async function findById(db: Database, id: string) {
  const [row] = await db.select(columns).from(schema.terms).where(eq(schema.terms.id, id)).limit(1);
  return row ?? null;
}

export async function create(db: Database, input: CreateInput) {
  // S9: nessuna gerarchia delle categorie.
  if (input.taxonomy === 'category' && input.parentId) {
    throw termError(400, 'TERM_PARENT_NOT_ALLOWED', 'Le categorie non hanno una categoria madre.');
  }
  try {
    const [row] = await db
      .insert(schema.terms)
      .values({
        taxonomy: input.taxonomy,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
        position: input.position ?? 0,
        path: await pathFor(db, input.taxonomy, input.parentId ?? null, input.slug),
      })
      .returning({ id: schema.terms.id });
    if (!row) throw new Error('termine non creato');
    return row.id;
  } catch (caught) {
    throw conflictFrom(caught) ?? caught;
  }
}

export async function update(db: Database, id: string, input: UpdateInput) {
  const current = await findById(db, id);
  if (!current) return null;
  // D140-A, S9: di una categoria si cambiano solo nome e descrizione; indirizzo e posto nell'albero restano.
  if (current.taxonomy === 'category') {
    if (input.slug !== undefined) {
      throw termError(
        400,
        'TERM_SLUG_FIXED',
        'L’indirizzo di una categoria non si cambia: si può rinominare solo il nome.',
      );
    }
    if (input.parentId !== undefined || input.position !== undefined) {
      throw termError(
        400,
        'TERM_FIELD_FIXED',
        'Di una categoria si cambiano solo il nome e la descrizione.',
      );
    }
  }

  const slug = input.slug ?? current.slug;
  const parentId = input.parentId === undefined ? current.parentId : (input.parentId ?? null);

  try {
    await db
      .update(schema.terms)
      .set({
        slug,
        parentId,
        name: input.name ?? current.name,
        description: input.description === undefined ? current.description : input.description,
        position: input.position ?? current.position,
        path: await pathFor(db, current.taxonomy, parentId, slug),
        updatedAt: new Date(),
      })
      .where(eq(schema.terms.id, id));
  } catch (caught) {
    throw conflictFrom(caught) ?? caught;
  }
  return findById(db, id);
}

export async function remove(db: Database, id: string): Promise<boolean> {
  const [used] = await db
    .select({ value: count() })
    .from(schema.contentTerms)
    .where(eq(schema.contentTerms.termId, id));
  if ((used?.value ?? 0) > 0) {
    throw Object.assign(new Error('il termine è usato da dei contenuti'), { statusCode: 409 });
  }
  const rows = await db
    .delete(schema.terms)
    .where(eq(schema.terms.id, id))
    .returning({ id: schema.terms.id });
  return rows.length > 0;
}
