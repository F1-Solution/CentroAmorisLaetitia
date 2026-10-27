import { schema, type Database } from '@amoris/db';
import { and, asc, eq, like, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { ObjectStore } from '../../lib/objectStore.js';
import { citedOutside, remove as removeMedia, type RemoveOptions } from '../media/service.js';
import type { createBody, updateBody } from './schemas.js';
import { loggableError } from '../media/storeErrorLog.js';
import { documentSlugFromTitle, nextFreeSlug } from './slug.js';

/** Servizio del dominio `documents`. Le rotte non toccano il database (ADR-001 §3 punto 2). */

type UpdateInput = z.infer<typeof updateBody>;
type CreateInput = z.infer<typeof createBody>;
/** Database o transazione: l'eliminazione ricalcola gli impedimenti dentro la propria. */
type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

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

function selectDocuments(db: Executor) {
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

export async function findById(db: Executor, id: string) {
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

function documentError(statusCode: 400 | 409, code: string, message: string): Error {
  return Object.assign(new Error(message), { statusCode, code });
}

const fileInvalid = () =>
  documentError(
    400,
    'DOCUMENT_FILE_INVALID',
    'Il file del documento deve essere un PDF caricato nella libreria.',
  );

const categoryInvalid = () =>
  documentError(
    400,
    'DOCUMENT_CATEGORY_INVALID',
    'Scegli una categoria dei download fra quelle esistenti.',
  );

/** Gli slug occupati che cominciano come quello proposto: documenti di ogni tipo e sorgenti dei redirect. */
async function takenSlugs(exec: Executor, base: string): Promise<Set<string>> {
  const prefix = `${base.slice(0, 190).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const documents = await exec
    .select({ slug: schema.documents.slug })
    .from(schema.documents)
    .where(like(schema.documents.slug, prefix));
  const redirects = await exec
    .select({ source: schema.redirects.sourcePath })
    .from(schema.redirects)
    .where(like(schema.redirects.sourcePath, `/download/${prefix}`));
  const fromRedirects = redirects.flatMap((row) => {
    const match = /^\/download\/([^/]+)\/?$/.exec(row.source);
    return match?.[1] ? [match[1]] : [];
  });
  return new Set([...documents.map((row) => row.slug), ...fromRedirects]);
}

/** Codice e vincolo di un errore di PostgreSQL, anche se avvolto da Drizzle. */
function pgError(error: unknown): { code?: unknown; constraint?: unknown } {
  const pg = (error as { cause?: unknown }).cause ?? error;
  const { code, constraint_name: constraint } = pg as { code?: unknown; constraint_name?: unknown };
  return { code, constraint };
}

/** Vero se l'errore è la violazione d'unicità dello slug. */
function isSlugClash(error: unknown): boolean {
  const { code, constraint } = pgError(error);
  return code === '23505' && (constraint === undefined || constraint === 'documents_slug_unique');
}

/** Un media o una categoria spariti fra il controllo e la scrittura diventano il rifiuto in italiano (M1). */
function translateMissingReference(error: unknown): unknown {
  const { code, constraint } = pgError(error);
  if (code !== '23503') return error;
  return typeof constraint === 'string' && constraint.includes('term_id')
    ? categoryInvalid()
    : fileInvalid();
}

const fileInUse = () =>
  documentError(
    409,
    'DOCUMENT_FILE_IN_USE',
    'Questo file è già il file di un altro documento: caricane uno nuovo.',
  );

/**
 * Dentro la transazione, con il media bloccato: un PDF pubblico della libreria che nessun
 * documento usa, riservati compresi, e una categoria dei download che non può sparire.
 */
async function assertCreatable(tx: Executor, input: CreateInput): Promise<void> {
  const [media] = await tx
    .select({ isPrivate: schema.media.isPrivate, mimeType: schema.media.mimeType })
    .from(schema.media)
    .where(eq(schema.media.id, input.mediaId))
    .for('update');
  if (!media || media.isPrivate || media.mimeType !== 'application/pdf') throw fileInvalid();
  const [used] = await tx
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(eq(schema.documents.mediaId, input.mediaId))
    .limit(1);
  // Stesso messaggio qualunque sia il documento: un riservato non si rivela.
  if (used) throw fileInUse();
  const [term] = await tx
    .select({ id: schema.terms.id })
    .from(schema.terms)
    .where(and(eq(schema.terms.id, input.termId), eq(schema.terms.taxonomy, 'wpdmcategory')))
    .for('share');
  if (!term) throw categoryInvalid();
}

/** Crea un documento pubblico come gli importati: data di creazione ora, modifica vuota (DR-281). */
export async function create(db: Database, input: CreateInput) {
  const base = documentSlugFromTitle(input.title);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const id = await db.transaction(async (tx) => {
        await assertCreatable(tx, input);
        const slug = nextFreeSlug(base, await takenSlugs(tx, base));
        const [row] = await tx
          .insert(schema.documents)
          .values({
            slug,
            title: input.title,
            description: input.description ?? null,
            mediaId: input.mediaId,
            isPrivate: false,
            publishedAt: new Date(),
          })
          .returning({ id: schema.documents.id });
        if (!row) throw new Error('documento non creato');
        await tx.insert(schema.documentTerms).values({ documentId: row.id, termId: input.termId });
        return row.id;
      });
      return await findById(db, id);
    } catch (error) {
      // Un'altra creazione ha preso lo stesso slug nel frattempo: si ricalcola.
      if (!isSlugClash(error)) throw translateMissingReference(error);
    }
  }
  throw documentError(409, 'DOCUMENT_SLUG_TAKEN', 'Lo slug del documento è occupato: riprova.');
}

/** La voce porta alla scheda: indirizzo relativo o assoluto, con o senza barra, query e ancora. */
function pointsTo(url: string, sitePath: string): boolean {
  try {
    const path = new URL(url, 'http://sito.invalid').pathname;
    const withSlash = path.endsWith('/') ? path : `${path}/`;
    return decodeURIComponent(withSlash) === decodeURIComponent(sitePath);
  } catch {
    // Un indirizzo o una codifica illeggibile non porta a nessuna scheda.
    return false;
  }
}

/** Che cosa impedisce l'eliminazione e che cosa resta; `null` se il documento non è visibile. */
export async function deletionBlockers(db: Executor, id: string) {
  const current = await findById(db, id);
  if (!current) return null;

  // Il blocco «Documento» cita l'identificativo: lo si cerca come testo, come i media citati (DR-077).
  const citing = await db
    .select({ id: schema.contents.id, title: schema.contents.title, path: schema.contents.path })
    .from(schema.contents)
    .where(sql`strpos(${schema.contents.blocks}::text, ${id}) > 0`)
    .orderBy(sql`${schema.contents.path} collate "C"`);
  const candidates = await db
    .select({
      id: schema.menuItems.id,
      label: schema.menuItems.label,
      menu: schema.menus.label,
      url: schema.menuItems.url,
    })
    .from(schema.menuItems)
    .innerJoin(schema.menus, eq(schema.menus.id, schema.menuItems.menuId))
    .where(and(eq(schema.menuItems.kind, 'custom'), like(schema.menuItems.url, '%/download/%')))
    .orderBy(asc(schema.menus.label), asc(schema.menuItems.label));
  const menuItems = candidates
    .filter((item) => item.url !== null && pointsTo(item.url, current.sitePath))
    .map(({ id: itemId, label, menu }) => ({ id: itemId, label, menu }));
  const redirects = await db
    .select({ source: schema.redirects.sourcePath })
    .from(schema.redirects)
    .where(
      or(
        eq(schema.redirects.targetPath, current.sitePath),
        eq(schema.redirects.targetPath, current.sitePath.slice(0, -1)),
      ),
    )
    .orderBy(sql`${schema.redirects.sourcePath} collate "C"`);

  return {
    blocked: citing.length > 0 || menuItems.length > 0,
    // Il titolo può mancare per scelta (home importata): si ripiega sul percorso.
    contents: citing.map((row) => ({ ...row, title: row.title || row.path })),
    menuItems,
    redirectsToPath: redirects,
    fileShared: await citedOutside(db, current.file.mediaId, id),
  };
}

type Preview = NonNullable<Awaited<ReturnType<typeof deletionBlockers>>>;

const listOf = (names: readonly string[]): string => names.map((name) => `«${name}»`).join(', ');

/** Il primo impedimento, con un messaggio che nomina contenuti o voci e menu. */
function assertDeletable(preview: Preview): void {
  if (preview.contents.length > 0) {
    throw documentError(
      409,
      'DOCUMENT_IN_USE',
      `Il documento è citato da un blocco «Documento» in: ${listOf(preview.contents.map((row) => row.title))}. Togli prima il blocco.`,
    );
  }
  if (preview.menuItems.length > 0) {
    const items = preview.menuItems.map((item) => `«${item.label}» (menu «${item.menu}»)`);
    throw documentError(
      409,
      'DOCUMENT_IN_MENU',
      `Il documento è in un menu: ${items.join(', ')}. Togli prima le voci dal menu.`,
    );
  }
}

export interface RemovedDocument {
  readonly title: string;
  readonly slug: string;
  readonly mediaId: string;
}

/**
 * Elimina il documento pubblico e i suoi legami alle categorie; il file resta a chi lo usa.
 * Restituisce ciò che il registro ricorda, o `null` se il documento non è visibile.
 */
export async function removeDocument(db: Database, id: string): Promise<RemovedDocument | null> {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .for('update');
    if (!locked) return null;
    const preview = await deletionBlockers(tx, id);
    if (!preview) return null;
    assertDeletable(preview);
    const [current] = await tx
      .select({
        title: schema.documents.title,
        slug: schema.documents.slug,
        mediaId: schema.documents.mediaId,
      })
      .from(schema.documents)
      .where(eq(schema.documents.id, id));
    if (!current) return null;
    await tx.delete(schema.documents).where(eq(schema.documents.id, id));
    return current;
  });
}

/** Toglie media e file del documento eliminato se nessun altro li usa; un guasto si annota e basta. */
export async function removeFileIfUnused(
  db: Database,
  store: ObjectStore,
  mediaId: string,
  options: RemoveOptions,
): Promise<void> {
  try {
    await removeMedia(db, store, mediaId, options);
  } catch (error) {
    // Ancora citato da altri: il file resta, ed è l'esito previsto.
    if ((error as { code?: unknown }).code === 'MEDIA_IN_USE') return;
    options.log?.error({ mediaId, err: loggableError(error) }, 'file del documento non rimosso');
  }
}
