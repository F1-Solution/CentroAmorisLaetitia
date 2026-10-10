import { schema, type Database } from '@amoris/db';
import { and, count, desc, eq, ilike, like, or, sql, type SQL } from 'drizzle-orm';
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

export interface ReplaceInput {
  readonly mimeType: string;
  readonly body: Buffer;
}

/**
 * Sostituzione del file di un media (DR-074, opzione A).
 *
 * I byte si riscrivono **sulla chiave che il media già usa**: il percorso
 * pubblico non cambia, e ogni riferimento — blocchi, `srcset`, indirizzi
 * storici — continua a funzionare. È anche il motivo per cui il tipo del file
 * non può cambiare: la chiave porta l'estensione del file di partenza, e
 * servire un PNG sotto un nome `.jpg` renderebbe il nome una bugia.
 *
 * L'operazione **non è annullabile**: il file precedente viene sovrascritto e
 * non esiste versione da recuperare. Chi la offre in interfaccia lo dichiara.
 */
export async function replaceFile(
  db: Database,
  store: ObjectStore,
  id: string,
  input: ReplaceInput,
) {
  const current = await findById(db, id);
  if (!current) return null;

  if (input.mimeType !== current.mimeType) {
    throw Object.assign(
      new Error(
        `Il file nuovo è di tipo ${input.mimeType}, quello sostituito è ${current.mimeType}. ` +
          'La sostituzione conserva indirizzo e nome del file, quindi il tipo deve coincidere.',
      ),
      { statusCode: 409 },
    );
  }

  const bucket = current.isPrivate ? store.privateBucket : store.publicBucket;
  await store.put(bucket, current.storageKey, input.body, input.mimeType);

  await db
    .update(schema.media)
    .set({
      byteSize: input.body.byteLength,
      checksum: createHash('sha256').update(input.body).digest(),
      updatedAt: new Date(),
    })
    .where(eq(schema.media.id, id));

  return findById(db, id);
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

/**
 * Contenuti che citano il media: in evidenza, oppure dentro il documento a
 * blocchi (DR-077).
 *
 * Il documento si cerca **come testo**, non prop per prop. I riferimenti a un
 * media vivono in proprietà diverse secondo il tipo di blocco — `mediaId` in
 * `image` e `media_text`, `posterMediaId` in `video` — e un elenco scritto a
 * mano andrebbe rifatto a ogni tipo nuovo, dimenticandosene uno. Un
 * identificativo è unico: cercarlo nel testo del documento non produce falsi
 * positivi e non dimentica nulla.
 *
 * Dal 2026-10-10 (DR-109) si cercano anche gli **indirizzi**: quello del media
 * e quelli delle sue dimensioni derivate, così come sono e codificati, perché
 * un blocco di riserva `html` scritto a mano cita il file per indirizzo e non
 * per identificativo. `strpos` invece di `like`: il trattino basso, frequente
 * nei nomi di file, per `like` è un carattere jolly.
 */
async function citedBy(db: Database, id: string, paths: readonly string[]) {
  const needles = [...new Set(paths.flatMap((path) => [path, encodeURI(path)]))];
  return db
    .select({ id: schema.contents.id, title: schema.contents.title })
    .from(schema.contents)
    .where(
      or(
        eq(schema.contents.featuredMediaId, id),
        sql`strpos(${schema.contents.blocks}::text, ${id}) > 0`,
        ...needles.map((needle) => sql`strpos(${schema.contents.blocks}::text, ${needle}) > 0`),
      ),
    )
    .limit(10);
}

/** Un media ancora citato da un contenuto non si elimina in silenzio. */
export async function remove(db: Database, store: ObjectStore, id: string): Promise<boolean> {
  const current = await findById(db, id);
  if (!current) return false;

  const variants = await db
    .select({
      storageKey: schema.mediaVariants.storageKey,
      publicPath: schema.mediaVariants.publicPath,
    })
    .from(schema.mediaVariants)
    .where(eq(schema.mediaVariants.mediaId, id));

  const used = await citedBy(db, id, [
    current.publicPath,
    ...variants.map((variant) => variant.publicPath),
  ]);
  if (used.length > 0) {
    const titles = used.map((row) => row.title).join(', ');
    throw Object.assign(
      new Error(
        `Il media è citato da questi contenuti e non si elimina finché lo citano: ${titles}.`,
      ),
      { statusCode: 409 },
    );
  }

  await db.delete(schema.media).where(eq(schema.media.id, id));

  const bucket = current.isPrivate ? store.privateBucket : store.publicBucket;
  for (const variant of variants) await store.remove(bucket, variant.storageKey);
  await store.remove(bucket, current.storageKey);
  return true;
}
