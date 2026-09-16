import { schema, type Database } from '@amoris/db';
import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { createBody, listQuery, updateBody } from './schemas.js';

/**
 * Servizio del dominio `redirects`.
 *
 * ADR-003 §3.5: i redirect sono **dati**, non configurazione del reverse proxy,
 * proprio perché restino modificabili di qui.
 */

type ListQuery = z.infer<typeof listQuery>;
type CreateInput = z.infer<typeof createBody>;
type UpdateInput = z.infer<typeof updateBody>;

const columns = {
  id: schema.redirects.id,
  sourcePath: schema.redirects.sourcePath,
  targetPath: schema.redirects.targetPath,
  statusCode: schema.redirects.statusCode,
  kind: schema.redirects.kind,
  origin: schema.redirects.origin,
  isActive: schema.redirects.isActive,
  note: schema.redirects.note,
  hitCount: schema.redirects.hitCount,
  lastHitAt: schema.redirects.lastHitAt,
};

export async function list(db: Database, query: ListQuery) {
  const filters: SQL[] = [];
  if (query.active) filters.push(eq(schema.redirects.isActive, query.active === 'true'));
  if (query.search) {
    const pattern = `%${query.search}%`;
    const match = or(
      ilike(schema.redirects.sourcePath, pattern),
      ilike(schema.redirects.targetPath, pattern),
    );
    if (match) filters.push(match);
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [total] = await db.select({ value: count() }).from(schema.redirects).where(where);
  const items = await db
    .select(columns)
    .from(schema.redirects)
    .where(where)
    .orderBy(asc(schema.redirects.sourcePath))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { items, total: total?.value ?? 0 };
}

export async function findById(db: Database, id: string) {
  const [row] = await db
    .select(columns)
    .from(schema.redirects)
    .where(eq(schema.redirects.id, id))
    .limit(1);
  return row ?? null;
}

export async function create(db: Database, input: CreateInput) {
  const [row] = await db
    .insert(schema.redirects)
    .values({
      sourcePath: input.sourcePath,
      targetPath: input.targetPath,
      statusCode: input.statusCode ?? 301,
      kind: input.kind ?? 'exact',
      // Quelli nati qui sono manuali: `migration` appartiene all'importer.
      origin: 'manual',
      note: input.note ?? null,
    })
    .returning({ id: schema.redirects.id });
  if (!row) throw new Error('redirect non creato');
  return row.id;
}

export async function update(db: Database, id: string, input: UpdateInput) {
  const current = await findById(db, id);
  if (!current) return null;

  await db
    .update(schema.redirects)
    .set({
      sourcePath: input.sourcePath ?? current.sourcePath,
      targetPath: input.targetPath ?? current.targetPath,
      statusCode: input.statusCode ?? current.statusCode,
      kind: input.kind ?? current.kind,
      isActive: input.isActive ?? current.isActive,
      note: input.note === undefined ? current.note : input.note,
      updatedAt: new Date(),
    })
    .where(eq(schema.redirects.id, id));
  return findById(db, id);
}

export async function remove(db: Database, id: string): Promise<boolean> {
  const rows = await db
    .delete(schema.redirects)
    .where(eq(schema.redirects.id, id))
    .returning({ id: schema.redirects.id });
  return rows.length > 0;
}
