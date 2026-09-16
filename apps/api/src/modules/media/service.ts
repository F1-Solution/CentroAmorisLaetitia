import { schema, type Database } from '@amoris/db';
import { and, count, desc, eq, ilike, like, or, type SQL } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type { ObjectStore } from '../../lib/objectStore.js';
import type { listQuery, updateBody } from './schemas.js';

/** Servizio del dominio `media` (ADR-004). */

type ListQuery = z.infer<typeof listQuery>;
type UpdateInput = z.infer<typeof updateBody>;

const columns = {
  id: schema.media.id,
  storageKey: schema.media.storageKey,
  publicPath: schema.media.publicPath,
  fileName: schema.media.fileName,
  mimeType: schema.media.mimeType,
  byteSize: schema.media.byteSize,
  width: schema.media.width,
  height: schema.media.height,
  title: schema.media.title,
  altText: schema.media.altText,
  caption: schema.media.caption,
  description: schema.media.description,
  isPrivate: schema.media.isPrivate,
  uploadedAt: schema.media.uploadedAt,
};

export async function list(db: Database, query: ListQuery) {
  const filters: SQL[] = [];
  if (query.mimePrefix) filters.push(like(schema.media.mimeType, `${query.mimePrefix}%`));
  if (query.search) {
    const pattern = `%${query.search}%`;
    const match = or(ilike(schema.media.fileName, pattern), ilike(schema.media.title, pattern));
    if (match) filters.push(match);
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [total] = await db.select({ value: count() }).from(schema.media).where(where);
  const items = await db
    .select(columns)
    .from(schema.media)
    .where(where)
    .orderBy(desc(schema.media.uploadedAt))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { items, total: total?.value ?? 0 };
}

export async function findById(db: Database, id: string) {
  const [row] = await db.select(columns).from(schema.media).where(eq(schema.media.id, id)).limit(1);
  return row ?? null;
}

/**
 * La chiave nel bucket segue la disposizione della sorgente — anno, mese, nome —
 * perché è quella che i percorsi storici di ADR-004 §3.4 sanno raggiungere.
 * Il nome non si normalizza: ADR-004 §3.1 lo vieta, perché farebbe divergere il
 * `srcset` delle varianti già esistenti.
 */
export function storageKeyFor(fileName: string, when: Date): string {
  const year = when.getUTCFullYear();
  const month = String(when.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${fileName}`;
}

export interface UploadInput {
  readonly fileName: string;
  readonly mimeType: string;
  readonly body: Buffer;
  readonly isPrivate: boolean;
  readonly uploadedBy: string;
}

/**
 * Il file entra nel bucket **prima** della riga a database: se il caricamento
 * fallisce non resta una riga che promette un file che non c'è. È la stessa
 * regola dell'importer.
 */
export async function upload(
  db: Database,
  store: ObjectStore,
  input: UploadInput,
): Promise<string> {
  const now = new Date();
  const storageKey = storageKeyFor(input.fileName, now);
  const bucket = input.isPrivate ? store.privateBucket : store.publicBucket;

  await store.put(bucket, storageKey, input.body, input.mimeType);

  const [row] = await db
    .insert(schema.media)
    .values({
      storageKey,
      publicPath: `/media/${storageKey}`,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.body.byteLength,
      checksum: createHash('sha256').update(input.body).digest(),
      isPrivate: input.isPrivate,
      uploadedAt: now,
      uploadedBy: input.uploadedBy,
    })
    .returning({ id: schema.media.id });

  if (!row) throw new Error('media non registrato');
  return row.id;
}

export async function update(db: Database, id: string, input: UpdateInput) {
  const current = await findById(db, id);
  if (!current) return null;

  await db
    .update(schema.media)
    .set({
      title: input.title === undefined ? current.title : input.title,
      altText: input.altText === undefined ? current.altText : input.altText,
      caption: input.caption === undefined ? current.caption : input.caption,
      description: input.description === undefined ? current.description : input.description,
      updatedAt: new Date(),
    })
    .where(eq(schema.media.id, id));
  return findById(db, id);
}

/** Un media ancora citato da un contenuto non si elimina in silenzio. */
export async function remove(db: Database, store: ObjectStore, id: string): Promise<boolean> {
  const current = await findById(db, id);
  if (!current) return false;

  const [used] = await db
    .select({ value: count() })
    .from(schema.contents)
    .where(eq(schema.contents.featuredMediaId, id));
  if ((used?.value ?? 0) > 0) {
    throw Object.assign(new Error('il media è in evidenza su dei contenuti'), { statusCode: 409 });
  }

  const variants = await db
    .select({ storageKey: schema.mediaVariants.storageKey })
    .from(schema.mediaVariants)
    .where(eq(schema.mediaVariants.mediaId, id));

  await db.delete(schema.media).where(eq(schema.media.id, id));

  const bucket = current.isPrivate ? store.privateBucket : store.publicBucket;
  for (const variant of variants) await store.remove(bucket, variant.storageKey);
  await store.remove(bucket, current.storageKey);
  return true;
}
