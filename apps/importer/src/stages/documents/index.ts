/**
 * Fase 9 `documents` (`importer-spec.md` §4): produce `documents` e
 * `document_terms`.
 *
 * Sorgente: `wp_posts` con `post_type = 'wpdmpro'` (4, pubblici) o
 * `post_type = 'cuar_private_file'` (4, riservati — DR-033), per un totale di
 * 8 righe (`wp-to-postgres-mapping.md`, righe su `wpdmpro`/`cuar_private_file`
 * e §4.1).
 *
 * ## Il collegamento al file — ora risolto
 *
 * `IMPORTER-DESIGN.md` §11.6 e §11.11 avevano misurato che nessuno degli 8
 * documenti aveva un file risolvibile: i 4 riservati vivono fuori da
 * `uploads/`, in `wp-content/customer-area/storage/<hash>/<nomefile>`
 * (`source/files/privateStorage.ts`); i 4 pubblici stanno in
 * `wp-content/uploads/download-manager-files/`, una cartella che ADR-004 §3.2
 * classificava come cartella di servizio da escludere.
 *
 * **DR-058** aggiunge il secondo lettore di sorgente per l'albero riservato
 * (`ctx.source.privateFiles()`), risolvendo per **nome di file esatto**: l'`id`
 * a 32 esadecimali nel meta `cuar_private_file_file` non è il nome della
 * cartella su disco (misurato, i due valori sono diversi), quindi la
 * corrispondenza si fa sul campo `file` del meta contro il nome del file
 * trovato sotto `storage/<hash>/`, mai contro un percorso costruito.
 * **DR-060** toglie `download-manager-files` dall'esclusione del lettore di
 * `uploads/` (`source/files/uploads.ts`), rendendo visibili i 4 file pubblici
 * a `ctx.source.uploadedFiles()`.
 *
 * I due archivi non si mescolano mai: il riservato guarda solo
 * `customer-area/storage/`, il pubblico solo `download-manager-files/`. I
 * nomi dei due gruppi sono quasi identici (con o senza trattini) ma sono otto
 * file distinti — la trappola già segnalata in `IMPORTER-DESIGN.md` §11.6 e
 * §11.11.
 *
 * ## Chiavi di storage
 *
 * Pubblici: `download-manager-files/<nomefile>` (bucket `public`, come già
 * restituito da `uploadedFiles()`). Riservati: `customer-area/<hash>/<nomefile>`
 * (bucket `private`, senza lettura anonima). Lo schema conserva la
 * disposizione della sorgente, ed è compatibile con la futura fase `rewrite`
 * che converte `wp-content/uploads/X` in `/media/X`.
 *
 * ## Che cosa fa questa fase
 *
 * Legge il nome del file di ciascun documento dal meta (`__wpdm_files` per i
 * pubblici, `cuar_private_file_file` per i riservati, entrambi serializzati
 * PHP), lo cerca nell'archivio giusto, carica il file nel bucket **prima**
 * della riga `media` (`importer-spec.md` §7, come `stages/media/index.ts`), e
 * in modo `plan` non scrive mai nel bucket. Un'estensione fuori dalla mappa
 * MIME chiusa, un file assente, un meta mancante o malformato, o un nome
 * ambiguo (stesso file in più cartelle riservate) producono ciascuno un
 * `import_issues` di gravità `warning` con codice `document-file-unresolved`
 * e un `detail` che distingue la causa; il documento non si scrive, perché
 * `documents.media_id` è `NOT NULL`.
 */
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { Tx } from '../../persistence/tx.js';
import type { SqlRow } from '../../source/sql/types.js';
import { checksumFile, type UploadedFile } from '../../source/files/uploads.js';
import type { PrivateStorageFile } from '../../source/files/privateStorage.js';
import { phpUnserialize, type PhpValue } from '../../source/php/unserialize.js';
import type { Bucket } from '../../storage/objectStore.js';

type LegacySource = 'wpdmpro' | 'cuar_private_file';

interface DocumentRow {
  readonly legacyId: number;
  readonly legacySource: LegacySource;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly downloadCount: number;
  readonly categoryTaxonomy: string; // 'wpdmcategory' | 'cuar_private_file_category'
  readonly categoryTermLegacyIds: readonly number[];
  /** `__wpdm_files` per i pubblici, `cuar_private_file_file` per i riservati, non ancora deserializzato. */
  readonly fileMetaRaw: string | null;
}

interface ResolvedDocumentFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly absolutePath: string;
  readonly sizeBytes: number;
  readonly storageKey: string;
  readonly publicPath: string;
  readonly isPrivate: boolean;
  readonly bucket: Bucket;
}

/**
 * Mappa chiusa estensione → MIME: si dichiara solo ciò che è misurato sugli 8
 * documenti (tutti `.pdf`), non si indovina un tipo per un'estensione mai
 * vista.
 */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
};

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function fileMetaKeyFor(legacySource: LegacySource): string {
  return legacySource === 'wpdmpro' ? '__wpdm_files' : 'cuar_private_file_file';
}

/**
 * Estrae il nome del file dal meta serializzato PHP. Per i pubblici
 * (`__wpdm_files`) il valore è direttamente una stringa; per i riservati
 * (`cuar_private_file_file`) è annidato sotto la chiave `file` della mappa
 * interna. Restituisce `null` — mai un'eccezione — quando la forma non è
 * quella attesa: il chiamante lo traduce in un `import_issues`.
 */
function extractDocumentFileName(raw: string, legacySource: LegacySource): string | null {
  let parsed: PhpValue;
  try {
    parsed = phpUnserialize(raw);
  } catch {
    return null;
  }
  if (!(parsed instanceof Map) || parsed.size === 0) return null;
  const firstValue = parsed.values().next().value as PhpValue;

  if (legacySource === 'wpdmpro') {
    return typeof firstValue === 'string' ? firstValue : null;
  }

  if (!(firstValue instanceof Map)) return null;
  const file = firstValue.get('file');
  return typeof file === 'string' ? file : null;
}

async function loadDocumentRows(ctx: StageContext): Promise<readonly DocumentRow[]> {
  const [postRows, metaRows, relationRows, taxonomyRows] = await Promise.all([
    ctx.source.rows('wp_posts'),
    ctx.source.rows('wp_postmeta'),
    ctx.source.rows('wp_term_relationships'),
    ctx.source.rows('wp_term_taxonomy'),
  ]);

  const metaByPost = new Map<number, Map<string, string>>();
  for (const row of metaRows as readonly SqlRow[]) {
    const postId = asNumber(row['post_id']);
    const key = asString(row['meta_key']);
    if (!metaByPost.has(postId)) metaByPost.set(postId, new Map());
    metaByPost.get(postId)!.set(key, asString(row['meta_value']));
  }

  const taxonomyById = new Map<number, { taxonomy: string; termId: number }>();
  for (const row of taxonomyRows as readonly SqlRow[]) {
    taxonomyById.set(asNumber(row['term_taxonomy_id']), {
      taxonomy: asString(row['taxonomy']),
      termId: asNumber(row['term_id']),
    });
  }
  const categoryTermsByPost = new Map<number, { taxonomy: string; ids: number[] }>();
  for (const row of relationRows as readonly SqlRow[]) {
    const objectId = asNumber(row['object_id']);
    const taxonomy = taxonomyById.get(asNumber(row['term_taxonomy_id']));
    if (!taxonomy) continue;
    const entry = categoryTermsByPost.get(objectId) ?? { taxonomy: taxonomy.taxonomy, ids: [] };
    entry.ids.push(taxonomy.termId);
    categoryTermsByPost.set(objectId, entry);
  }

  const rows: DocumentRow[] = [];
  for (const row of postRows as readonly SqlRow[]) {
    const postType = asString(row['post_type']);
    if (postType !== 'wpdmpro' && postType !== 'cuar_private_file') continue;

    const legacyId = asNumber(row['ID']);
    const meta = metaByPost.get(legacyId) ?? new Map<string, string>();
    const category = categoryTermsByPost.get(legacyId);

    // Descrizione: solo per i documenti pubblici, dai testi del blocco
    // «termini e condizioni» del download, quando presenti (`__wpdm_terms_*`,
    // `wp-to-postgres-mapping.md` §4.1). I riservati non hanno questi meta.
    const description = [meta.get('__wpdm_terms_title'), meta.get('__wpdm_terms_conditions')]
      .filter((v): v is string => Boolean(v && v.trim()))
      .join('\n\n');

    rows.push({
      legacyId,
      legacySource: postType,
      slug: asString(row['post_name']),
      title: asString(row['post_title']),
      description: description || null,
      downloadCount: asNumber(meta.get('__wpdm_download_count')),
      categoryTaxonomy: category?.taxonomy ?? '',
      categoryTermLegacyIds: category?.ids ?? [],
      fileMetaRaw: meta.get(fileMetaKeyFor(postType)) || null,
    });
  }
  return rows;
}

/**
 * Cerca il file sorgente di un documento nell'archivio giusto per il suo tipo
 * e ne calcola le chiavi di storage. Non tocca né il database né il bucket:
 * solo lettura del filesystem e dei meta. `detail` è `null` solo quando
 * `file` è risolto.
 */
async function resolveSourceFile(
  ctx: StageContext,
  row: DocumentRow,
  downloadManagerFilesByName: ReadonlyMap<string, UploadedFile>,
  privateFilesByName: ReadonlyMap<string, readonly PrivateStorageFile[]>,
): Promise<{ readonly file: ResolvedDocumentFile | null; readonly detail: string | null }> {
  if (!row.fileMetaRaw) {
    return {
      file: null,
      detail:
        row.legacySource === 'wpdmpro'
          ? 'wpdm-files-meta-missing'
          : 'cuar-private-file-meta-missing',
    };
  }

  const fileName = extractDocumentFileName(row.fileMetaRaw, row.legacySource);
  if (!fileName) {
    return {
      file: null,
      detail:
        row.legacySource === 'wpdmpro'
          ? 'wpdm-files-meta-malformed'
          : 'cuar-private-file-meta-malformed',
    };
  }

  const extension = path.posix.extname(fileName).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) {
    return { file: null, detail: 'document-mime-type-unsupported' };
  }

  if (row.legacySource === 'wpdmpro') {
    const found = downloadManagerFilesByName.get(fileName);
    if (!found) return { file: null, detail: 'download-manager-file-not-found' };
    return {
      file: {
        fileName,
        mimeType,
        absolutePath: path.join(ctx.source.uploadsPath, found.relativePath),
        sizeBytes: found.sizeBytes,
        storageKey: found.relativePath,
        publicPath: `/media/${found.relativePath}`,
        isPrivate: false,
        bucket: 'public',
      },
      detail: null,
    };
  }

  const matches = privateFilesByName.get(fileName) ?? [];
  if (matches.length === 0) return { file: null, detail: 'private-storage-file-not-found' };
  // Ambiguità (nome duplicato in più cartelle dell'archivio riservato): non si
  // sceglie, si dichiara — vedi il commento di testa del modulo.
  if (matches.length > 1) return { file: null, detail: 'private-storage-file-ambiguous' };

  const match = matches[0]!;
  return {
    file: {
      fileName,
      mimeType,
      absolutePath: path.join(ctx.source.privateStoragePath, match.relativePath),
      sizeBytes: match.sizeBytes,
      storageKey: `customer-area/${match.relativePath}`,
      publicPath: `/media/customer-area/${match.relativePath}`,
      isPrivate: true,
      bucket: 'private',
    },
    detail: null,
  };
}

/**
 * Punto d'innesto storico (`IMPORTER-DESIGN.md` §11.6): oggi risolve
 * davvero, con lo stesso ordine di `stages/media/index.ts` — il file entra nel
 * bucket **prima** della riga `media`, in `plan` non si scrive mai nel bucket,
 * e il caricamento si salta quando il checksum non è cambiato. La riga viene
 * registrata in `import_id_map` per `(wp_posts, legacyId, 'media')`, così una
 * riesecuzione trova la stessa riga invece di duplicarla.
 */
async function resolveDocumentMedia(
  ctx: StageContext,
  tx: Tx,
  row: DocumentRow,
  downloadManagerFilesByName: ReadonlyMap<string, UploadedFile>,
  privateFilesByName: ReadonlyMap<string, readonly PrivateStorageFile[]>,
): Promise<{ readonly mediaId: string | null; readonly detail: string }> {
  const { file, detail } = await resolveSourceFile(
    ctx,
    row,
    downloadManagerFilesByName,
    privateFilesByName,
  );
  if (!file) return { mediaId: null, detail: detail ?? 'document-file-unresolved' };

  const checksumHex = await checksumFile(file.absolutePath);
  const checksum = Buffer.from(checksumHex, 'hex');

  const existingId = await ctx.ids.find(tx, 'wp_posts', row.legacyId, 'media');
  let existingChecksum: Buffer | null = null;
  if (existingId) {
    const [existing] = await tx
      .select({ checksum: schema.media.checksum })
      .from(schema.media)
      .where(eq(schema.media.id, existingId));
    existingChecksum = existing?.checksum ?? null;
  }
  const needsUpload = !existingChecksum || !existingChecksum.equals(checksum);

  // Il file entra nel bucket **prima** della riga (`importer-spec.md` §7): in
  // `plan` non si scrive mai nel bucket (§5.2).
  if (ctx.mode === 'apply' && needsUpload) {
    await ctx.storage.put(
      file.bucket,
      file.storageKey,
      file.absolutePath,
      file.mimeType,
      file.sizeBytes,
    );
  }

  const [written] = await tx
    .insert(schema.media)
    .values({
      id: existingId ?? undefined,
      storageKey: file.storageKey,
      publicPath: file.publicPath,
      fileName: file.fileName,
      mimeType: file.mimeType,
      byteSize: file.sizeBytes,
      checksum,
      isPrivate: file.isPrivate,
      uploadedAt: new Date(),
      legacyId: row.legacyId,
    })
    .onConflictDoUpdate({
      target: schema.media.id,
      set: {
        storageKey: file.storageKey,
        publicPath: file.publicPath,
        fileName: file.fileName,
        mimeType: file.mimeType,
        byteSize: file.sizeBytes,
        checksum,
        isPrivate: file.isPrivate,
        legacyId: row.legacyId,
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.media.id });
  if (!written) throw new Error('inserimento di media non ha restituito una riga');

  await ctx.ids.remember(
    tx,
    'wp_posts',
    row.legacyId,
    'media',
    written.id,
    ctx.mode === 'apply' ? ctx.runId : null,
    existingId ? 'updated' : 'created',
  );

  return { mediaId: written.id, detail: '' };
}

export const documentsStage: Stage = {
  name: 'documents',
  dependsOn: ['media', 'terms'],

  async expected(ctx: StageContext) {
    return (await loadDocumentRows(ctx)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const rows = await loadDocumentRows(ctx);

    const uploadedFiles = await ctx.source.uploadedFiles();
    const downloadManagerFilesByName = new Map<string, UploadedFile>();
    for (const file of uploadedFiles) {
      if (!file.relativePath.startsWith('download-manager-files/')) continue;
      downloadManagerFilesByName.set(path.posix.basename(file.relativePath), file);
    }

    const privateFiles = await ctx.source.privateFiles();
    const privateFilesByName = new Map<string, PrivateStorageFile[]>();
    for (const file of privateFiles) {
      const matches = privateFilesByName.get(file.fileName) ?? [];
      matches.push(file);
      privateFilesByName.set(file.fileName, matches);
    }

    return forEachItem(
      ctx.tx,
      rows,
      (row): ItemKey => ({ sourceTable: 'wp_posts', sourceId: row.legacyId }),
      async (row, tx) => {
        const { mediaId, detail } = await resolveDocumentMedia(
          ctx,
          tx,
          row,
          downloadManagerFilesByName,
          privateFilesByName,
        );
        if (!mediaId) {
          await ctx.issues.record({
            severity: 'warning',
            stage: 'documents',
            code: 'document-file-unresolved',
            sourceTable: 'wp_posts',
            sourceId: row.legacyId,
            detail,
          });
          return 'skipped';
        }

        const existingId = await ctx.ids.find(tx, 'wp_posts', row.legacyId, 'document');
        const [written] = await tx
          .insert(schema.documents)
          .values({
            id: existingId ?? undefined,
            slug: row.slug,
            title: row.title,
            description: row.description,
            mediaId,
            isPrivate: row.legacySource === 'cuar_private_file',
            downloadCount: row.downloadCount,
            legacyId: row.legacyId,
            legacySource: row.legacySource,
          })
          .onConflictDoUpdate({
            target: schema.documents.id,
            set: {
              slug: row.slug,
              title: row.title,
              description: row.description,
              mediaId,
              isPrivate: row.legacySource === 'cuar_private_file',
              downloadCount: row.downloadCount,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.documents.id });
        if (!written) throw new Error('inserimento di documents non ha restituito una riga');

        await ctx.ids.remember(
          tx,
          'wp_posts',
          row.legacyId,
          'document',
          written.id,
          ctx.mode === 'apply' ? ctx.runId : null,
          existingId ? 'updated' : 'created',
        );

        // `document_terms`: stessa cautela di `relations/index.ts` per i
        // riferimenti a termine non risolvibili. Le tassonomie dei documenti
        // (`wpdmcategory`, `cuar_private_file_category`) non sono ancora fra
        // quelle importate da `terms/index.ts`: i riferimenti restano
        // irrisolti finché non lo saranno (vedi anche `menus/index.ts`, stesso
        // limite per una voce di menu).
        await tx
          .delete(schema.documentTerms)
          .where(eq(schema.documentTerms.documentId, written.id));
        for (const termLegacyId of row.categoryTermLegacyIds) {
          const termId = await ctx.ids.find(tx, 'wp_terms', termLegacyId, 'term');
          if (!termId) {
            await ctx.issues.record({
              severity: 'warning',
              stage: 'documents',
              code: 'item-import-failed',
              sourceTable: 'wp_term_relationships',
              sourceId: row.legacyId,
              detail: 'unresolved-term-reference',
            });
            continue;
          }
          await tx
            .insert(schema.documentTerms)
            .values({ documentId: written.id, termId })
            .onConflictDoNothing();
        }

        return existingId ? 'updated' : 'created';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'documents',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );
  },
};
