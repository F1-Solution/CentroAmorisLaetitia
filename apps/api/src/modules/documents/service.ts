import { schema, type Database } from '@amoris/db';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { updateBody } from './schemas.js';

/** Servizio del dominio `documents`. Le rotte non toccano il database (ADR-001 §3 punto 2). */

type UpdateInput = z.infer<typeof updateBody>;

const columns = {
  id: schema.documents.id,
  slug: schema.documents.slug,
  title: schema.documents.title,
  description: schema.documents.description,
  publishedAt: schema.documents.publishedAt,
  modifiedAt: schema.documents.modifiedAt,
  mediaId: schema.media.id,
  fileName: schema.media.fileName,
  mimeType: schema.media.mimeType,
  byteSize: schema.media.byteSize,
  publicPath: schema.media.publicPath,
};

type Row = Awaited<ReturnType<typeof selectDocuments>>[number];

function serialise(row: Row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    modifiedAt: row.modifiedAt?.toISOString() ?? null,
    sitePath: `/download/${row.slug}/`,
    file: {
      mediaId: row.mediaId,
      fileName: row.fileName,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      publicPath: row.publicPath,
    },
  };
}

/** Solo i documenti pubblici con il file pubblico: un riservato non esiste per l'area (S1). */
const visible = and(eq(schema.documents.isPrivate, false), eq(schema.media.isPrivate, false));

function selectDocuments(db: Database) {
  return db
    .select(columns)
    .from(schema.documents)
    .innerJoin(schema.media, eq(schema.media.id, schema.documents.mediaId))
    .$dynamic();
}

export async function list(db: Database) {
  const rows = await selectDocuments(db)
    .where(visible)
    .orderBy(sql`lower(${schema.documents.title})`, asc(schema.documents.id));
  return rows.map(serialise);
}

export async function findById(db: Database, id: string) {
  const [row] = await selectDocuments(db)
    .where(and(eq(schema.documents.id, id), visible))
    .limit(1);
  return row ? serialise(row) : null;
}

/** Salva i campi indicati e la data di modifica (D156-A); `null` se il documento non è visibile. */
export async function update(db: Database, id: string, input: UpdateInput) {
  const current = await findById(db, id);
  if (!current) return null;
  const now = new Date();
  await db
    .update(schema.documents)
    .set({
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: input.description }),
      modifiedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.documents.id, id));
  return findById(db, id);
}
