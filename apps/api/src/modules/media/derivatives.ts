import { schema } from '@amoris/db';
import { or, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { ObjectStore } from '../../lib/objectStore.js';
import type { Transaction } from './fileName.js';
import { derivativeFileName } from './sizes.js';
import { storeErrorFields } from './storeErrorLog.js';
import type { EncodedImage } from './variants.js';

/** Percorsi, blocchi e citazioni delle dimensioni derivate, condivisi da caricamento e sostituzione. */

/** Una derivata pronta da scrivere: dove va e che cosa contiene. */
export interface PlannedFile {
  readonly file: EncodedImage;
  readonly storageKey: string;
  readonly publicPath: string;
}

export interface Logger {
  error(context: object, message: string): void;
}

export const publicPathOf = (storageKey: string): string => `/media/${storageKey}`;
export const checksumOf = (body: Buffer): Buffer => createHash('sha256').update(body).digest();
export const folderOfKey = (storageKey: string): string => {
  const slash = storageKey.lastIndexOf('/');
  return slash < 0 ? '' : storageKey.slice(0, slash);
};

/** `nome.jpg` diventa `nome-scaled.jpg`. */
export function withScaledSuffix(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? `${fileName}-scaled` : `${fileName.slice(0, dot)}-scaled${fileName.slice(dot)}`;
}

/** Le derivate di un file, con il nome `<base>-LxA.<est>` nella cartella data. */
export function planFiles(
  files: readonly EncodedImage[],
  folder: string,
  base: string,
  extension: string,
): PlannedFile[] {
  return files.map((file) => {
    const name = derivativeFileName(base, extension, file.width, file.height);
    const storageKey = folder ? `${folder}/${name}` : name;
    return { file, storageKey, publicPath: publicPathOf(storageKey) };
  });
}

/** Le righe di `media_variants` di un elenco di derivate. */
export function variantValues(mediaId: string, planned: readonly PlannedFile[]) {
  return planned.map((one) => variantValue(mediaId, one));
}

export function variantValue(mediaId: string, one: PlannedFile) {
  return {
    mediaId,
    storageKey: one.storageKey,
    publicPath: one.publicPath,
    width: one.file.width,
    height: one.file.height,
    byteSize: one.file.body.byteLength,
    checksum: checksumOf(one.file.body),
  };
}

/** Scrive i file uno alla volta, nell'ordine dato; `written` tiene le chiavi tentate. */
export async function putAll(
  store: ObjectStore,
  bucket: string,
  mime: string,
  files: readonly { key: string; body: Buffer }[],
  written: string[],
): Promise<void> {
  for (const file of files) {
    written.push(file.key);
    await store.put(bucket, file.key, file.body, mime);
  }
}

/** Impronta breve di una chiave: il nome del file può contenere dati personali e non si registra. */
const digestOf = (key: string): string =>
  createHash('sha256').update(key).digest('hex').slice(0, 12);

/** Toglie oggetti dall'archivio senza interrompere chi chiama: ogni errore va nel log, senza la chiave. */
export async function removeQuietly(
  store: ObjectStore,
  bucket: string,
  keys: readonly string[],
  log: Logger | undefined,
  context: object,
): Promise<void> {
  for (const key of keys) {
    await store.remove(bucket, key).catch((error: unknown) => {
      log?.error(
        {
          ...context,
          keyDigest: digestOf(key),
          objects: keys.length,
          err: storeErrorFields(error),
        },
        'oggetto non rimosso dall’archivio',
      );
    });
  }
}

const lock = (tx: Transaction, key: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}::text))`);

/** Mette in fila le sostituzioni dello stesso media. */
export const lockMedia = (tx: Transaction, id: string) => lock(tx, `media.replace:${id}`);

/** Mette in fila chi sceglie nomi nella stessa cartella `AAAA/MM`, preso dopo quello del media e tenuto fino alla conferma. */
export const lockFolder = (tx: Transaction, folder: string) => lock(tx, `media.folder:${folder}`);

export interface VanishingVariant {
  readonly id: string;
  readonly storageKey: string;
  readonly publicPath: string;
  readonly width: number;
  readonly height: number;
}

/** Vero se un blocco di quel media sceglie `variant` fra le misure date. */
function choosesVariant(node: unknown, mediaId: string, sizes: ReadonlySet<string>): boolean {
  if (Array.isArray(node)) return node.some((child) => choosesVariant(child, mediaId, sizes));
  if (typeof node !== 'object' || node === null) return false;
  const record = node as Record<string, unknown>;
  const variant = record['variant'];
  if (record['mediaId'] === mediaId && typeof variant === 'string' && sizes.has(variant)) {
    return true;
  }
  return Object.values(record).some((child) => choosesVariant(child, mediaId, sizes));
}

/** Titoli (al massimo dieci) dei contenuti che citano una derivata destinata a sparire, per percorso o con `variant` (D146-A). */
export async function citingVariants(
  tx: Transaction,
  mediaId: string,
  vanishing: readonly VanishingVariant[],
): Promise<string[]> {
  const needles = [
    ...new Set(vanishing.flatMap((variant) => [variant.publicPath, encodeURI(variant.publicPath)])),
  ];
  const sizes = new Set(vanishing.map((variant) => `${variant.width}x${variant.height}`));
  const [byAddress, byMedia] = await Promise.all([
    tx
      .select({ id: schema.contents.id, title: schema.contents.title })
      .from(schema.contents)
      .where(
        or(...needles.map((needle) => sql`strpos(${schema.contents.blocks}::text, ${needle}) > 0`)),
      )
      .limit(10),
    tx
      .select({
        id: schema.contents.id,
        title: schema.contents.title,
        blocks: schema.contents.blocks,
      })
      .from(schema.contents)
      .where(sql`strpos(${schema.contents.blocks}::text, ${mediaId}) > 0`),
  ]);
  const titles = new Map(byAddress.map((row) => [row.id, row.title]));
  for (const row of byMedia) {
    if (choosesVariant(row.blocks, mediaId, sizes)) titles.set(row.id, row.title);
  }
  return [...titles.values()].slice(0, 10);
}
