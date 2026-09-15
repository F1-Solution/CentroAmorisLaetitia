/**
 * Fase 9 `documents` (`importer-spec.md` §4): produce `documents` e
 * `document_terms`.
 *
 * Sorgente: `wp_posts` con `post_type = 'wpdmpro'` (4, pubblici) o
 * `post_type = 'cuar_private_file'` (4, riservati — DR-033), per un totale di
 * 8 righe (`wp-to-postgres-mapping.md`, righe su `wpdmpro`/`cuar_private_file`
 * e §4.1).
 *
 * ## Il collegamento al file — misurato, non presupposto
 *
 * `IMPORTER-DESIGN.md` §11.6 avvertiva che i 4 documenti **riservati** non
 * stanno in `uploads/`: vivono in
 * `wp-content/customer-area/storage/<uuid>/<file>`, un albero che nessun
 * lettore dell'importer visita oggi (`cuar_private_file_file` in
 * `wp_postmeta`, che contiene quel percorso, non un id di allegato).
 *
 * Misurato ora, per completare il quadro sui 4 **pubblici**: la chiave
 * `__wpdm_files` dà solo un **nome di file** (`"Modulo per consulenze.pdf"`,
 * niente id di allegato), e quel nome **non compare** fra i 170 allegati
 * importati dalla fase 3 (né come `_wp_attached_file`, né come figlio di
 * questi post). Il file fisico esiste — sotto
 * `wp-content/uploads/download-manager-files/` — ma quella cartella è
 * **esclusa** dal lettore di `uploads/` (`source/files/uploads.ts`,
 * `EXCLUDED_TOP_LEVEL_FOLDERS`, e ADR-004 §3.2 la elenca fra le cartelle di
 * servizio). Per questa ragione i suoi 4 PDF sono citati in
 * `IMPORTER-DESIGN.md` §11.1 e §11.6 come «una trappola»: hanno nomi quasi
 * identici ai 4 riservati (spazi invece di trattini), ma sono **file
 * diversi** — non si deve, e qui non si fa, risolvere l'uno con l'altro.
 *
 * **Conclusione**: nessuno degli 8 documenti ha, oggi, un `media_id`
 * risolvibile senza un secondo lettore di sorgente — uno per
 * `download-manager-files/` (4 pubblici) e uno per
 * `wp-content/customer-area/storage/` (4 riservati). È più di quanto il
 * perimetro di questa sotto-wave anticipasse (solo i 4 riservati): si
 * dichiara qui, non si nasconde. Nessuno dei due lettori esiste, e costruirne
 * uno non è una decisione di questa fase (`IMPORTER-DESIGN.md` §11.6: «va
 * dichiarato come decisione, non risolto di iniziativa»).
 *
 * ## Che cosa fa questa fase, quindi
 *
 * Importa le **righe** — titolo, slug, descrizione, stato, conteggio
 * download, tassonomie — perché quelle stanno nel dump e sono nel perimetro.
 * Per ciascuno degli 8 documenti, se il file non è risolvibile (oggi: tutti
 * e 8), registra un `import_issues` di gravità `warning` con codice
 * riconoscibile (`document-file-unresolved`) e **non scrive la riga
 * `documents`**: `documents.media_id` è `NOT NULL` (`packages/db/src/schema/documents.ts`),
 * e scrivere un `media_id` inventato violerebbe sia quel vincolo nella sua
 * intenzione sia la regola di non indovinare un percorso.
 *
 * `resolveDocumentMedia` è il punto d'innesto: il giorno in cui un secondo
 * lettore esiste, questa funzione — e solo questa — cambia. Il resto della
 * fase (lettura delle righe, tassonomie, ciclo per elemento) resta com'è.
 */
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { Tx } from '../../persistence/tx.js';
import type { SqlRow } from '../../source/sql/types.js';

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
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
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
    });
  }
  return rows;
}

/**
 * Punto d'innesto per un secondo lettore di sorgente (vedi il commento di
 * testa). Controlla prima `import_id_map`, per il caso in cui un lettore
 * futuro — o un'altra fase — abbia già registrato un `media` per questo
 * `legacyId`: così l'innesto è aggiungere quel lettore altrove, non riscrivere
 * questa funzione. Oggi nessuno lo fa mai, per nessuno degli 8 documenti:
 * nessuno dei due archivi (`download-manager-files/`, `customer-area/storage/`)
 * è raggiungibile da `ctx.source`. Il `detail` distingue le due cause per il
 * rapporto.
 */
async function resolveDocumentMedia(
  ctx: StageContext,
  tx: Tx,
  row: DocumentRow,
): Promise<{ readonly mediaId: string | null; readonly detail: string }> {
  const existing = await ctx.ids.find(tx, 'wp_posts', row.legacyId, 'media');
  if (existing) return { mediaId: existing, detail: '' };

  const detail =
    row.legacySource === 'wpdmpro'
      ? 'download-manager-files-excluded' // ADR-004 §3.2, source/files/uploads.ts
      : 'private-customer-area-storage-unreached'; // IMPORTER-DESIGN.md §11.6
  return { mediaId: null, detail };
}

export const documentsStage: Stage = {
  name: 'documents',
  dependsOn: ['media', 'terms'],

  async expected(ctx: StageContext) {
    return (await loadDocumentRows(ctx)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const rows = await loadDocumentRows(ctx);

    return forEachItem(
      ctx.tx,
      rows,
      (row): ItemKey => ({ sourceTable: 'wp_posts', sourceId: row.legacyId }),
      async (row, tx) => {
        const { mediaId, detail } = await resolveDocumentMedia(ctx, tx, row);
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

        // Codice raggiungibile solo quando `resolveDocumentMedia` risolve
        // davvero un file — non ancora, oggi (vedi sopra).
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
        // riferimenti a termine non risolvibili. Misurato: le tassonomie dei
        // documenti (`wpdmcategory`, `cuar_private_file_category`) non sono
        // fra quelle che `terms/index.ts` importa (solo `category`) — vedi
        // anche `menus/index.ts`, stesso limite per una voce di menu.
        await tx.delete(schema.documentTerms).where(eq(schema.documentTerms.documentId, written.id));
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
