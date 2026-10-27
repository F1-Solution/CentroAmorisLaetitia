import {
  docBlockPropsSchema,
  mapPropsSchema,
  normalizeYouTubeUrl,
  videoPropsSchema,
} from '@amoris/blocks/model';
import { schema, type Database } from '@amoris/db';
import { and, eq, inArray } from 'drizzle-orm';

/**
 * Video, mappe e documenti configurati dall'editor (DR-279): ciò che lo schema condiviso non
 * può sapere da solo, cioè quali indirizzi, media e documenti sono ammessi.
 */

type DatabaseOrTx = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

interface RawBlock {
  readonly id?: unknown;
  readonly type?: unknown;
  readonly props?: Record<string, unknown>;
  readonly children?: unknown;
}

interface RawDocument {
  readonly blocks?: unknown;
}

const PROPS_SCHEMAS = {
  video: videoPropsSchema,
  map: mapPropsSchema,
  document: docBlockPropsSchema,
} as const;

const CHECKED_TYPES = new Set(Object.keys(PROPS_SCHEMAS));

/** Le proprietà con i valori predefiniti dello schema: un blocco importato senza chiavi facoltative non risulta cambiato. */
function withDefaults(type: unknown, props: unknown): unknown {
  const propsSchema = PROPS_SCHEMAS[type as keyof typeof PROPS_SCHEMAS];
  const parsed = propsSchema?.safeParse(props);
  return parsed?.success ? parsed.data : props;
}

function blockError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400, code: 'CONTENT_BLOCK_INVALID' });
}

/** I blocchi di un documento, in profondità. */
function* walk(nodes: unknown): Generator<RawBlock> {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes as RawBlock[]) {
    if (node === null || typeof node !== 'object') continue;
    yield node;
    yield* walk(node.children);
  }
}

/** I blocchi controllati già salvati, per identificativo, con le loro proprietà in JSON. */
function storedByIdOf(current: RawDocument | null): Map<string, RawBlock> {
  const stored = new Map<string, RawBlock>();
  for (const block of walk(current?.blocks)) {
    if (typeof block.id === 'string' && CHECKED_TYPES.has(String(block.type)))
      stored.set(block.id, block);
  }
  return stored;
}

/** Due valori JSON uguali a meno dell'ordine delle chiavi (`jsonb` non lo conserva). */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

interface Pending {
  readonly libraryVideos: Set<string>;
  readonly posterPaths: Set<string>;
  readonly posterIds: Set<string>;
  readonly documentIds: Set<string>;
}

function checkVideo(props: Record<string, unknown>, pending: Pending): void {
  const src = typeof props.src === 'string' ? props.src : '';
  if (props.provider === 'youtube') {
    if (normalizeYouTubeUrl(src) !== src)
      throw blockError(
        'Il video deve essere un indirizzo YouTube nella forma https://www.youtube.com/watch?v=…: nessun altro sito è ammesso.',
      );
  } else if (props.provider === 'file') {
    pending.libraryVideos.add(src);
  } else {
    throw blockError('Il video si sceglie fra gli MP4 della libreria o con un indirizzo YouTube.');
  }
  if (typeof props.posterSrc === 'string') pending.posterPaths.add(props.posterSrc);
  if (typeof props.posterMediaId === 'string') pending.posterIds.add(props.posterMediaId);
}

/** L'html dei segnaposto non si modifica: ogni html non vuoto deve venire dal blocco salvato. */
function checkMap(props: Record<string, unknown>, stored: RawBlock | undefined): void {
  const htmlOf = (pins: unknown): (string | null)[] =>
    Array.isArray(pins)
      ? pins.map((pin: { html?: unknown }) => (typeof pin?.html === 'string' ? pin.html : null))
      : [];
  const available = htmlOf(stored?.props?.pins);
  for (const html of htmlOf(props.pins)) {
    if (html === null) continue;
    const index = available.indexOf(html);
    if (index < 0)
      throw blockError(
        'Il testo dei segnaposto della mappa viene dal sito di partenza e non si modifica.',
      );
    available.splice(index, 1);
  }
}

async function checkLibrary(db: DatabaseOrTx, pending: Pending): Promise<void> {
  const publicMedia = async (column: 'publicPath' | 'id', values: Set<string>) =>
    values.size === 0
      ? []
      : db
          .select({
            id: schema.media.id,
            publicPath: schema.media.publicPath,
            mimeType: schema.media.mimeType,
          })
          .from(schema.media)
          .where(
            and(inArray(schema.media[column], [...values]), eq(schema.media.isPrivate, false)),
          );

  const videos = await publicMedia('publicPath', pending.libraryVideos);
  for (const path of pending.libraryVideos) {
    if (!videos.some((row) => row.publicPath === path && row.mimeType === 'video/mp4'))
      throw blockError('Il video scelto non è un MP4 pubblico della libreria dei media.');
  }

  const posterByPath = await publicMedia('publicPath', pending.posterPaths);
  const posterById = await publicMedia('id', pending.posterIds);
  const isImage = (row: { mimeType: string }) => row.mimeType.startsWith('image/');
  for (const path of pending.posterPaths) {
    if (!posterByPath.some((row) => row.publicPath === path && isImage(row)))
      throw blockError('L’anteprima del video deve essere un’immagine pubblica della libreria.');
  }
  for (const id of pending.posterIds) {
    if (!posterById.some((row) => row.id === id && isImage(row)))
      throw blockError('L’anteprima del video deve essere un’immagine pubblica della libreria.');
  }

  if (pending.documentIds.size === 0) return;
  const documents = await db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .innerJoin(schema.media, eq(schema.media.id, schema.documents.mediaId))
    .where(
      and(
        inArray(schema.documents.id, [...pending.documentIds]),
        eq(schema.documents.isPrivate, false),
        eq(schema.media.isPrivate, false),
      ),
    );
  for (const id of pending.documentIds) {
    if (!documents.some((row) => row.id === id))
      throw blockError('Il documento scelto non è fra i documenti pubblici.');
  }
}

/**
 * Rifiuta i video, le mappe e i documenti nuovi o cambiati rispetto a `current` che non
 * rispettano DR-279; quelli invariati restano come sono (andata e ritorno 1D-36).
 */
export async function assertBlockReferencesValid(
  db: DatabaseOrTx,
  next: RawDocument,
  current: RawDocument | null,
): Promise<void> {
  const stored = storedByIdOf(current);
  const pending: Pending = {
    libraryVideos: new Set(),
    posterPaths: new Set(),
    posterIds: new Set(),
    documentIds: new Set(),
  };
  const seen = new Set<unknown>();
  for (const block of walk(next.blocks)) {
    if (!CHECKED_TYPES.has(String(block.type))) continue;
    // Una copia con lo stesso identificativo passerebbe per «invariata» senza controlli.
    if (seen.has(block.id))
      throw blockError('Due blocchi video, mappa o documento hanno lo stesso identificativo.');
    seen.add(block.id);
    const before = typeof block.id === 'string' ? stored.get(block.id) : undefined;
    if (
      before !== undefined &&
      before.type === block.type &&
      sameJson(withDefaults(before.type, before.props), withDefaults(block.type, block.props))
    )
      continue;
    const props = block.props ?? {};
    if (block.type === 'video') checkVideo(props, pending);
    else if (block.type === 'map') checkMap(props, before?.type === 'map' ? before : undefined);
    else if (typeof props.documentId === 'string') pending.documentIds.add(props.documentId);
  }
  await checkLibrary(db, pending);
}
