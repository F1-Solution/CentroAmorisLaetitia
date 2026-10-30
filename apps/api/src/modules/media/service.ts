import { mediaMessages, type MediaLimits, type MediaRule } from '@amoris/contracts';
import { schema, type Database } from '@amoris/db';
import { and, count, desc, eq, ilike, inArray, like, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { ObjectStore } from '../../lib/objectStore.js';
import {
  checksumOf,
  citingVariants,
  folderOfKey,
  lockFolder,
  lockMedia,
  planFiles,
  publicPathOf,
  putAll,
  removeQuietly,
  variantValue,
  variantValues,
  withScaledSuffix,
  type Logger,
  type PlannedFile,
  type VanishingVariant,
} from './derivatives.js';
import { sanitizeFileName, takenPaths, uniqueFileName, type Transaction } from './fileName.js';
import { detectMime, inspectUpload, mediaError } from './fileType.js';
import { inMediaTransaction, type MediaRuntime } from './runtime.js';
import {
  ScrubTooLargeError,
  ScrubUnavailableError,
  ScrubUnreadableError,
  scrubFile,
  type ScrubTools,
} from './scrub.js';
import type { listQuery, updateBody } from './schemas.js';
import { sourceBaseName, splitFileName } from './sizes.js';
import { loggableError } from './storeErrorLog.js';
import { processImage, type ProcessedImage } from './variants.js';

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
  const filters: SQL[] = [eq(schema.media.isPrivate, false)];
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

/** I media riservati non esistono per l'area (DR-218, ADR-004 §3.6). */
export async function findById(db: Database, id: string) {
  const [row] = await db
    .select(columns)
    .from(schema.media)
    .where(and(eq(schema.media.id, id), eq(schema.media.isPrivate, false)))
    .limit(1);
  return row ?? null;
}

/** La chiave nel bucket segue la disposizione della sorgente: anno, mese, nome (ADR-004 §3.4). */
export function folderFor(when: Date): string {
  const year = when.getUTCFullYear();
  const month = String(when.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}`;
}

export interface UploadInput {
  readonly fileName: string;
  readonly body: Buffer;
  readonly limits: MediaLimits;
  readonly isPrivate: boolean;
  readonly uploadedBy: string;
  readonly log?: Logger;
  readonly runtime?: MediaRuntime;
  /** Programmi della pulizia dei metadati, dalla configurazione. */
  readonly scrub: ScrubTools;
}

export interface Uploaded {
  readonly id: string;
  /** Quante dimensioni derivate sono nate con il file. */
  readonly derivatives: number;
}

interface UploadContext {
  readonly input: UploadInput;
  readonly mime: string;
  readonly processed: ProcessedImage | null;
  readonly body: Buffer;
  readonly now: Date;
  readonly folder: string;
  readonly bucket: string;
}

/** Esegue dentro il semaforo, se c'è. */
const gated = <T>(runtime: MediaRuntime | undefined, task: () => Promise<T>): Promise<T> =>
  runtime ? runtime.gate.run(task) : task();

/** Come ripulire e come annotare un rifiuto: il log riceve strumento, uscita e durata, mai il nome. */
interface ScrubContext {
  readonly tools: ScrubTools;
  readonly log: Logger | undefined;
}

/** Ripulisce PDF e MP4 (DR-254): ciò che non si ripulisce non si salva, e il file ripulito rispetta il limite del suo tipo. */
async function scrubBody(
  fileName: string,
  mime: string,
  rule: MediaRule,
  body: Buffer,
  context: ScrubContext,
): Promise<Buffer> {
  try {
    return await scrubFile(mime, body, context.tools, rule.maxBytes, context.log);
  } catch (error) {
    if (error instanceof ScrubTooLargeError) {
      throw mediaError('MEDIA_TOO_LARGE', mediaMessages.tooLarge(fileName, rule));
    }
    if (error instanceof ScrubUnavailableError) {
      context.log?.error({ ...error.trace }, 'pulizia dei metadati non disponibile');
      throw mediaError('MEDIA_SCRUB_UNAVAILABLE', mediaMessages.scrubUnavailable());
    }
    if (error instanceof ScrubUnreadableError) {
      context.log?.warn?.({ ...error.trace }, 'file rifiutato dalla pulizia dei metadati');
      throw mediaError('MEDIA_FILE_INVALID', mediaMessages.fileInvalid(fileName));
    }
    throw error;
  }
}

/** Immagini: controllo e `sharp` nel semaforo delle immagini; un errore di `sharp` è un file illeggibile (M-5). */
async function processImageUpload(
  fileName: string,
  body: Buffer,
  limits: MediaLimits,
  runtime: MediaRuntime | undefined,
  accept?: (mime: string) => void,
): Promise<{ mime: string; processed: ProcessedImage | null; body: Buffer }> {
  return gated(runtime, async () => {
    const inspected = await inspectUpload(fileName, body, limits);
    accept?.(inspected.mime);
    try {
      const processed = await processImage(body, inspected.mime, limits.imagePixels);
      return { mime: inspected.mime, processed, body: processed.original.body };
    } catch {
      throw mediaError('MEDIA_FILE_INVALID', mediaMessages.fileInvalid(fileName));
    }
  });
}

/** Controlla il file; le immagini passano da `sharp`, PDF e MP4 dalla pulizia, ognuno nel proprio semaforo. */
async function inspectAndProcess(
  fileName: string,
  body: Buffer,
  limits: MediaLimits,
  runtime: MediaRuntime | undefined,
  scrub: ScrubContext,
  accept?: (mime: string) => void,
): Promise<{ mime: string; processed: ProcessedImage | null; body: Buffer }> {
  if (detectMime(body)?.startsWith('image/')) {
    return processImageUpload(fileName, body, limits, runtime, accept);
  }
  const inspected = await inspectUpload(fileName, body, limits);
  accept?.(inspected.mime);
  const task = async () => scrubBody(fileName, inspected.mime, inspected.rule, body, scrub);
  const cleaned = await (runtime ? runtime.scrubGate.run(task) : task());
  return { mime: inspected.mime, processed: null, body: cleaned };
}

/** Percorsi che un nome candidato occuperebbe oltre al proprio: `-scaled` e derivate. */
function extraPathsOf(processed: ProcessedImage | null, folder: string) {
  return (candidate: string): string[] => {
    if (!processed) return [];
    const { stem, extension } = splitFileName(candidate);
    return [
      ...(processed.scaled ? [publicPathOf(`${folder}/${withScaledSuffix(candidate)}`)] : []),
      ...planFiles(processed.derivatives, folder, stem, extension).map((one) => one.publicPath),
    ];
  };
}

/** Riga del media, righe delle derivate e oggetti, dentro la transazione della cartella. */
async function writeUpload(
  tx: Transaction,
  store: ObjectStore,
  context: UploadContext,
  candidate: string,
  written: string[],
): Promise<Uploaded> {
  const { input, processed, body, folder } = context;
  const fileName = processed?.scaled ? withScaledSuffix(candidate) : candidate;
  const storageKey = `${folder}/${fileName}`;
  const { stem, extension } = splitFileName(candidate);
  const derived = processed ? planFiles(processed.derivatives, folder, stem, extension) : [];

  const [row] = await tx
    .insert(schema.media)
    .values({
      storageKey,
      publicPath: publicPathOf(storageKey),
      fileName,
      mimeType: context.mime,
      byteSize: body.byteLength,
      width: processed ? processed.original.width : null,
      height: processed ? processed.original.height : null,
      checksum: checksumOf(body),
      isPrivate: input.isPrivate,
      uploadedAt: context.now,
      uploadedBy: input.uploadedBy,
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media non registrato');
  if (derived.length > 0) {
    await tx.insert(schema.mediaVariants).values(variantValues(row.id, derived));
  }
  const files = [
    { key: storageKey, body },
    ...derived.map((one) => ({ key: one.storageKey, body: one.file.body })),
  ];
  await putAll(store, context.bucket, context.mime, files, written);
  return { id: row.id, derivatives: derived.length };
}

/** Carica un file: controllo sul contenuto, riscrittura delle immagini (D145-A) e scrittura sotto il blocco della cartella. */
export async function upload(
  db: Database,
  store: ObjectStore,
  input: UploadInput,
): Promise<Uploaded> {
  const requested = sanitizeFileName(input.fileName);
  const { mime, processed, body } = await inspectAndProcess(
    requested,
    input.body,
    input.limits,
    input.runtime,
    { tools: input.scrub, log: input.log },
  );
  const folder = folderFor(new Date());
  const context: UploadContext = {
    input,
    mime,
    processed,
    body,
    now: new Date(),
    folder,
    bucket: input.isPrivate ? store.privateBucket : store.publicBucket,
  };
  const written: string[] = [];
  let compensated = false;
  try {
    return await inMediaTransaction(db, input.runtime, async (tx) => {
      try {
        await lockFolder(tx, folder);
        const candidate = await uniqueFileName(tx, {
          folder,
          fileName: requested,
          extraPaths: extraPathsOf(processed, folder),
        });
        return await writeUpload(tx, store, context, candidate, written);
      } catch (error) {
        // Gli oggetti scritti si tolgono prima di liberare il blocco, così nessuno ne sceglie i nomi.
        await removeQuietly(store, context.bucket, written, input.log, { folder });
        compensated = true;
        throw error;
      }
    });
  } catch (error) {
    // DR-261, N4: un errore al COMMIT arriva dopo il lavoro e lascerebbe gli oggetti senza riga.
    if (!compensated) {
      await removeUnclaimed(db, store, input.runtime, context.bucket, folder, written, input.log);
    }
    throw error;
  }
}

/** Toglie gli oggetti di un lavoro non confermato, sotto il blocco della cartella e saltando i nomi tornati in uso. */
async function removeUnclaimed(
  db: Database,
  store: ObjectStore,
  runtime: MediaRuntime | undefined,
  bucket: string,
  folder: string,
  keys: readonly string[],
  log: Logger | undefined,
): Promise<void> {
  if (keys.length === 0) return;
  try {
    await inMediaTransaction(db, runtime, async (tx) => {
      await lockFolder(tx, folder);
      const taken = await takenPaths(tx, keys.map(publicPathOf));
      const free = keys.filter((key) => !taken.has(publicPathOf(key)));
      await removeQuietly(store, bucket, free, log, { folder });
    });
  } catch (error) {
    log?.error({ folder, err: loggableError(error) }, 'oggetti non rimossi dall’archivio');
  }
}

export interface ReplaceInput {
  readonly fileName: string;
  readonly body: Buffer;
  readonly limits: MediaLimits;
  /** Dove si annota, con l'id del media, ciò che non si completa. */
  readonly log?: Logger;
  readonly runtime?: MediaRuntime;
  readonly scrub: ScrubTools;
}

export interface Replaced {
  readonly row: NonNullable<Awaited<ReturnType<typeof findById>>>;
  /** Derivate scritte (nuove o riscritte) e tolte. */
  readonly derivatives: { readonly written: number; readonly removed: number };
}

type MediaRow = NonNullable<Awaited<ReturnType<typeof findById>>>;

/** Chi e dove si ripulisce l'archivio dopo la conferma. */
interface PurgeContext {
  readonly id: string;
  readonly bucket: string;
  readonly folder: string;
}

interface ReplaceContext {
  readonly id: string;
  readonly mime: string;
  readonly processed: ProcessedImage | null;
  readonly body: Buffer;
  readonly bucket: string;
  readonly folder: string;
}

/** Tracce di una sostituzione, per compensare solo ciò che la transazione ha scritto. */
interface ReplaceTrace {
  written: string[];
  created: string[];
  /** Vero se le derivate nuove sono già state tolte dentro la transazione. */
  compensated: boolean;
}

/** Base delle derivate: senza `-scaled`, salvo che le derivate esistenti usino il nome intero. */
function baseOf(fileName: string, existingPaths: readonly string[]): string {
  const { base, extension } = sourceBaseName(fileName);
  const whole = splitFileName(fileName).stem;
  const usesWhole =
    whole !== base &&
    existingPaths.some((path) => path.includes(`/${whole}-`) && path.endsWith(`.${extension}`));
  return usesWhole ? whole : base;
}

/** Controlli sul file nuovo e sua elaborazione, prima di toccare qualunque cosa. */
async function prepareReplacement(db: Database, id: string, input: ReplaceInput) {
  const current = await findById(db, id);
  if (!current) return null;
  const { mime, processed, body } = await inspectAndProcess(
    sanitizeFileName(input.fileName),
    input.body,
    input.limits,
    input.runtime,
    { tools: input.scrub, log: input.log },
    (found) => {
      if (found !== current.mimeType) {
        throw mediaError('MEDIA_TYPE_CHANGED', mediaMessages.typeChanged(found, current.mimeType));
      }
    },
  );
  return { current, mime, processed, body };
}

interface ReplacePlan {
  /** Stesso nome di una derivata esistente: si riscrive sulla stessa riga. */
  readonly rewrite: PlannedFile[];
  /** Nome nuovo: riga nuova. */
  readonly fresh: PlannedFile[];
  readonly vanishing: VanishingVariant[];
}

/** Quali derivate si riscrivono, quali nascono e quali spariscono, sotto i blocchi. */
async function planReplacement(
  tx: Transaction,
  locked: MediaRow,
  existing: readonly VanishingVariant[],
  processed: ProcessedImage | null,
): Promise<ReplacePlan> {
  const { extension } = sourceBaseName(locked.fileName);
  const folder = folderOfKey(locked.storageKey);
  const base = baseOf(
    locked.fileName,
    existing.map((variant) => variant.publicPath),
  );
  const all = processed ? planFiles(processed.derivatives, folder, base, extension) : [];

  // Un nome già di un altro media non si sovrascrive: quella misura si salta.
  const ownPaths = new Set(existing.map((variant) => variant.publicPath));
  const taken = await takenPaths(
    tx,
    all.map((one) => one.publicPath),
  );
  const usable = all.filter((one) => ownPaths.has(one.publicPath) || !taken.has(one.publicPath));
  const kept = new Set(usable.map((one) => one.publicPath));
  return {
    rewrite: usable.filter((one) => ownPaths.has(one.publicPath)),
    fresh: usable.filter((one) => !ownPaths.has(one.publicPath)),
    vanishing: existing.filter((variant) => !kept.has(variant.publicPath)),
  };
}

/** Aggiorna riga e derivate di questo media; le nuove si inseriscono senza upsert, così un percorso altrui dà 23505. */
async function writeReplacementRows(
  tx: Transaction,
  context: ReplaceContext,
  plan: ReplacePlan,
): Promise<void> {
  const { id, processed, body } = context;
  await tx
    .update(schema.media)
    .set({
      byteSize: body.byteLength,
      checksum: checksumOf(body),
      width: processed ? processed.original.width : null,
      height: processed ? processed.original.height : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.media.id, id));
  if (plan.vanishing.length > 0) {
    const ids = plan.vanishing.map((variant) => variant.id);
    await tx.delete(schema.mediaVariants).where(inArray(schema.mediaVariants.id, ids));
  }
  for (const one of plan.rewrite) {
    const { storageKey, width, height, byteSize, checksum } = variantValue(id, one);
    await tx
      .update(schema.mediaVariants)
      .set({ storageKey, width, height, byteSize, checksum })
      .where(
        and(
          eq(schema.mediaVariants.mediaId, id),
          eq(schema.mediaVariants.publicPath, one.publicPath),
        ),
      );
  }
  if (plan.fresh.length > 0) {
    await tx.insert(schema.mediaVariants).values(variantValues(id, plan.fresh));
  }
}

/** I passi della sostituzione: blocchi, controllo D146-A, righe, oggetti. */
async function replaceSteps(
  tx: Transaction,
  store: ObjectStore,
  context: ReplaceContext,
  trace: ReplaceTrace,
) {
  const { id } = context;
  await lockMedia(tx, id);
  await lockFolder(tx, context.folder);
  const [locked] = await tx.select(columns).from(schema.media).where(eq(schema.media.id, id));
  if (!locked) return null;

  const existing = await tx
    .select({
      id: schema.mediaVariants.id,
      storageKey: schema.mediaVariants.storageKey,
      publicPath: schema.mediaVariants.publicPath,
      width: schema.mediaVariants.width,
      height: schema.mediaVariants.height,
    })
    .from(schema.mediaVariants)
    .where(eq(schema.mediaVariants.mediaId, id));
  const plan = await planReplacement(tx, locked, existing, context.processed);

  if (plan.vanishing.length > 0) {
    const titles = await citingVariants(tx, id, plan.vanishing);
    if (titles.length > 0) {
      throw mediaError(
        'MEDIA_VARIANT_IN_USE',
        mediaMessages.variantInUse(titles.join(', '), context.processed !== null),
      );
    }
  }
  await writeReplacementRows(tx, context, plan);
  // D156: la data dei documenti che citano il file cambia insieme al file.
  const now = new Date();
  await tx
    .update(schema.documents)
    .set({ modifiedAt: now, updatedAt: now })
    .where(eq(schema.documents.mediaId, id));

  trace.created = plan.fresh.map((one) => one.storageKey);
  const files = [
    { key: locked.storageKey, body: context.body },
    ...[...plan.rewrite, ...plan.fresh].map((one) => ({
      key: one.storageKey,
      body: one.file.body,
    })),
  ];
  await putAll(store, context.bucket, context.mime, files, trace.written);
  return { written: plan.rewrite.length + plan.fresh.length, vanishing: plan.vanishing };
}

/** La sostituzione dentro la transazione; se fallisce toglie le derivate nuove prima di liberare i blocchi. */
async function replaceInTransaction(
  tx: Transaction,
  store: ObjectStore,
  context: ReplaceContext,
  trace: ReplaceTrace,
  log: Logger | undefined,
) {
  try {
    return await replaceSteps(tx, store, context, trace);
  } catch (error) {
    const orphans = trace.created.filter((key) => trace.written.includes(key));
    await removeQuietly(store, context.bucket, orphans, log, { mediaId: context.id });
    trace.compensated = true;
    throw error;
  }
}

/** Toglie gli oggetti dall'archivio sotto i blocchi, saltando i nomi che nel frattempo sono tornati in uso. */
async function purgeVanished(
  db: Database,
  store: ObjectStore,
  runtime: MediaRuntime | undefined,
  context: PurgeContext,
  vanishing: readonly { publicPath: string; storageKey: string }[],
  log: Logger | undefined,
): Promise<void> {
  if (vanishing.length === 0) return;
  try {
    await inMediaTransaction(db, runtime, async (tx) => {
      await lockMedia(tx, context.id);
      await lockFolder(tx, context.folder);
      const taken = await takenPaths(
        tx,
        vanishing.map((variant) => variant.publicPath),
      );
      const free = vanishing.filter((variant) => !taken.has(variant.publicPath));
      await removeQuietly(
        store,
        context.bucket,
        free.map((variant) => variant.storageKey),
        log,
        { mediaId: context.id },
      );
    });
  } catch (error) {
    log?.error(
      { mediaId: context.id, err: loggableError(error) },
      'oggetti non rimossi dall’archivio',
    );
  }
}

/** Sostituisce il file di un media sulla stessa chiave (DR-074): indirizzo e tipo invariati, operazione non annullabile. */
export async function replaceFile(
  db: Database,
  store: ObjectStore,
  id: string,
  input: ReplaceInput,
): Promise<Replaced | null> {
  const prepared = await prepareReplacement(db, id, input);
  if (!prepared) return null;
  const { current, processed, body } = prepared;
  const context: ReplaceContext = {
    id,
    mime: prepared.mime,
    processed,
    body,
    bucket: current.isPrivate ? store.privateBucket : store.publicBucket,
    folder: folderOfKey(current.storageKey),
  };
  const trace: ReplaceTrace = { written: [], created: [], compensated: false };

  let outcome;
  try {
    outcome = await inMediaTransaction(db, input.runtime, (tx) =>
      replaceInTransaction(tx, store, context, trace, input.log),
    );
  } catch (error) {
    // DR-261, N4: dopo un errore al COMMIT le derivate nuove restano senza riga.
    if (!trace.compensated) {
      const orphans = trace.created.filter((key) => trace.written.includes(key));
      await removeUnclaimed(
        db,
        store,
        input.runtime,
        context.bucket,
        context.folder,
        orphans,
        input.log,
      );
    }
    // I rifiuti con codice non sono guasti da annotare.
    if (!(error instanceof Error && 'statusCode' in error)) {
      input.log?.error(
        { mediaId: id, err: loggableError(error) },
        'sostituzione del file non completata',
      );
    }
    throw error;
  }
  if (!outcome) return null;

  await purgeVanished(db, store, input.runtime, context, outcome.vanishing, input.log);
  const row = await findById(db, id);
  if (!row) return null;
  return { row, derivatives: { written: outcome.written, removed: outcome.vanishing.length } };
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

/** Al posto del titolo di un documento riservato, che non esce dall'area (L3). */
const PRIVATE_DOCUMENT_LABEL = 'un documento riservato';

/** Titoli di documenti e caroselli che citano il media (S7). */
async function citedByDocumentsOrSlides(db: Database | Transaction, id: string): Promise<string[]> {
  const documents = await db
    .select({ title: schema.documents.title, isPrivate: schema.documents.isPrivate })
    .from(schema.documents)
    .where(eq(schema.documents.mediaId, id))
    .limit(10);
  const sliders = await db
    .selectDistinct({ title: schema.sliders.title })
    .from(schema.sliderSlides)
    .innerJoin(schema.sliders, eq(schema.sliders.id, schema.sliderSlides.sliderId))
    .where(eq(schema.sliderSlides.mediaId, id))
    .limit(10);
  return [
    ...documents.map((row) => (row.isPrivate ? PRIVATE_DOCUMENT_LABEL : row.title)),
    ...sliders.map((row) => row.title),
  ];
}

/** Contenuti che citano il media per identificativo, in evidenza o per indirizzo, cercati come testo (DR-077, DR-109). */
async function citedBy(db: Database | Transaction, id: string, paths: readonly string[]) {
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

/** Vero se il media resta citato da contenuti, caroselli o documenti diversi da quello indicato (DR-281). */
export async function citedOutside(
  db: Database | Transaction,
  id: string,
  exceptDocumentId: string,
): Promise<boolean> {
  const [media] = await db
    .select({ publicPath: schema.media.publicPath })
    .from(schema.media)
    .where(eq(schema.media.id, id));
  if (!media) return false;
  const variants = await db
    .select({ publicPath: schema.mediaVariants.publicPath })
    .from(schema.mediaVariants)
    .where(eq(schema.mediaVariants.mediaId, id));
  const contents = await citedBy(db, id, [media.publicPath, ...variants.map((v) => v.publicPath)]);
  const [other] = await db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(
      and(eq(schema.documents.mediaId, id), sql`${schema.documents.id} <> ${exceptDocumentId}`),
    )
    .limit(1);
  const [slide] = await db
    .select({ id: schema.sliderSlides.id })
    .from(schema.sliderSlides)
    .where(eq(schema.sliderSlides.mediaId, id))
    .limit(1);
  return contents.length > 0 || Boolean(other) || Boolean(slide);
}

export interface RemoveOptions {
  readonly runtime?: MediaRuntime;
  readonly log?: Logger;
}

/** Righe da togliere e oggetti da cancellare di un media eliminato. */
async function deleteRows(tx: Transaction, id: string, folder: string) {
  await lockMedia(tx, id);
  await lockFolder(tx, folder);
  const [locked] = await tx.select(columns).from(schema.media).where(eq(schema.media.id, id));
  if (!locked) return null;

  const variants = await tx
    .select({
      storageKey: schema.mediaVariants.storageKey,
      publicPath: schema.mediaVariants.publicPath,
    })
    .from(schema.mediaVariants)
    .where(eq(schema.mediaVariants.mediaId, id));

  const used = await citedBy(tx, id, [
    locked.publicPath,
    ...variants.map((variant) => variant.publicPath),
  ]);
  const titles = [...used.map((row) => row.title), ...(await citedByDocumentsOrSlides(tx, id))];
  if (titles.length > 0) {
    throw mediaError('MEDIA_IN_USE', mediaMessages.inUse(titles.join(', ')));
  }
  await tx.delete(schema.media).where(eq(schema.media.id, id));
  return [...variants, { storageKey: locked.storageKey, publicPath: locked.publicPath }];
}

/** Un media ancora citato da un contenuto non si elimina in silenzio; gli oggetti si tolgono dopo, sotto i blocchi. */
export async function remove(
  db: Database,
  store: ObjectStore,
  id: string,
  options: RemoveOptions = {},
): Promise<boolean> {
  const current = await findById(db, id);
  if (!current) return false;
  const context: PurgeContext = {
    id,
    bucket: current.isPrivate ? store.privateBucket : store.publicBucket,
    folder: folderOfKey(current.storageKey),
  };
  const gone = await inMediaTransaction(db, options.runtime, (tx) =>
    deleteRows(tx, id, context.folder),
  );
  if (!gone) return false;
  await purgeVanished(db, store, options.runtime, context, gone, options.log);
  return true;
}
