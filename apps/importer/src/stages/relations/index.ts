/**
 * Fase 6 `relations` (`importer-spec.md` §4): produce `content_terms`,
 * `contents.featuredMediaId`, `contents.parentId` e `contents.path` — i
 * quattro campi che la fase `contents` lascia provvisori o vuoti perché
 * dipendono da entità che nascono altrove: il genitore è un altro contenuto,
 * l'immagine in evidenza è un `media`, e i termini sono `terms`
 * (`wp-to-postgres-mapping.md` §3.1, §4.1).
 *
 * L'unità di elaborazione è il **contenuto**, non la singola relazione: per
 * ciascuno si ricalcolano genitore, percorso, immagine in evidenza e insieme
 * dei termini in un solo elemento del ciclo (`forEachItem`), cosi' un errore
 * su un contenuto isola tutte e quattro le sue relazioni insieme, non una per
 * una.
 */
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';
import { resolvePaths, type PathNode } from './paths.js';

interface ContentRow {
  readonly dbId: string;
  readonly legacyId: number;
  readonly type: 'page' | 'post';
  readonly slug: string;
}

interface CategoryRelation {
  readonly termLegacyId: number;
  readonly position: number;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

async function loadContentRows(ctx: StageContext): Promise<readonly ContentRow[]> {
  const rows = await ctx.tx
    .select({
      id: schema.contents.id,
      legacyId: schema.contents.legacyId,
      type: schema.contents.type,
      slug: schema.contents.slug,
    })
    .from(schema.contents);
  return rows
    .filter((r): r is typeof r & { legacyId: number } => r.legacyId !== null)
    .map((r) => ({ dbId: r.id, legacyId: r.legacyId, type: r.type, slug: r.slug }));
}

async function loadParentLegacyIds(ctx: StageContext): Promise<ReadonlyMap<number, number>> {
  const rows = await ctx.source.rows('wp_posts');
  const byId = new Map<number, number>();
  for (const row of rows as readonly SqlRow[]) {
    const id = asNumber(row['ID']);
    byId.set(id, asNumber(row['post_parent']));
  }
  return byId;
}

/** `_thumbnail_id` per contenuto (`wp-to-postgres-mapping.md` §4.1): l'id dell'allegato in evidenza. */
async function loadFeaturedAttachmentIds(ctx: StageContext): Promise<ReadonlyMap<number, number>> {
  const rows = await ctx.source.rows('wp_postmeta');
  const byPost = new Map<number, number>();
  for (const row of rows as readonly SqlRow[]) {
    if (asString(row['meta_key']) !== '_thumbnail_id') continue;
    const postId = asNumber(row['post_id']);
    const attachmentId = asNumber(row['meta_value']);
    if (attachmentId > 0) byPost.set(postId, attachmentId);
  }
  return byPost;
}

/** Solo `taxonomy = 'category'` (`terms/index.ts`): le altre non producono `terms`. */
async function loadCategoryRelations(ctx: StageContext): Promise<ReadonlyMap<number, readonly CategoryRelation[]>> {
  const [relationshipRows, taxonomyRows] = await Promise.all([
    ctx.source.rows('wp_term_relationships'),
    ctx.source.rows('wp_term_taxonomy'),
  ]);

  const categoryTermByTaxonomyId = new Map<number, number>();
  for (const row of taxonomyRows as readonly SqlRow[]) {
    if (asString(row['taxonomy']) !== 'category') continue;
    categoryTermByTaxonomyId.set(asNumber(row['term_taxonomy_id']), asNumber(row['term_id']));
  }

  const byObjectId = new Map<number, CategoryRelation[]>();
  for (const row of relationshipRows as readonly SqlRow[]) {
    const taxonomyId = asNumber(row['term_taxonomy_id']);
    const termLegacyId = categoryTermByTaxonomyId.get(taxonomyId);
    if (termLegacyId === undefined) continue; // non una categoria: non produce content_terms
    const objectId = asNumber(row['object_id']);
    const relations = byObjectId.get(objectId) ?? [];
    relations.push({ termLegacyId, position: asNumber(row['term_order']) });
    byObjectId.set(objectId, relations);
  }
  return byObjectId;
}

export const relationsStage: Stage = {
  name: 'relations',
  dependsOn: ['contents'],

  async expected(ctx: StageContext) {
    return (await loadContentRows(ctx)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const contentRows = await loadContentRows(ctx);
    const parentLegacyIds = await loadParentLegacyIds(ctx);
    const featuredAttachmentIds = await loadFeaturedAttachmentIds(ctx);
    const categoryRelations = await loadCategoryRelations(ctx);

    const pathNodes: PathNode[] = contentRows.map((row) => ({
      legacyId: row.legacyId,
      dbId: row.dbId,
      type: row.type,
      slug: row.slug,
      parentLegacyId: parentLegacyIds.get(row.legacyId) ?? 0,
    }));
    const resolvedPaths = resolvePaths(pathNodes);

    return forEachItem(
      ctx.tx,
      contentRows,
      (row): ItemKey => ({ sourceTable: 'wp_posts', sourceId: row.legacyId }),
      async (row, tx) => {
        const resolved = resolvedPaths.get(row.legacyId);
        if (!resolved) throw new Error('percorso non calcolato per un contenuto noto');

        const featuredAttachmentLegacyId = featuredAttachmentIds.get(row.legacyId);
        const featuredMediaId = featuredAttachmentLegacyId
          ? await ctx.ids.find(tx, 'wp_posts', featuredAttachmentLegacyId, 'media')
          : null;
        if (featuredAttachmentLegacyId && !featuredMediaId) {
          // `_thumbnail_id` punta a un allegato che questa esecuzione non ha
          // risolto (per esempio l'allegato non recuperabile di
          // `IMPORTER-DESIGN.md` §11.7): si registra e si prosegue senza
          // immagine in evidenza, non si ferma il contenuto per questo.
          await ctx.issues.record({
            severity: 'warning',
            stage: 'relations',
            code: 'item-import-failed',
            sourceTable: 'wp_postmeta',
            sourceId: row.legacyId,
            detail: 'unresolved-featured-media',
          });
        }

        await tx
          .update(schema.contents)
          .set({
            parentId: resolved.parentDbId,
            path: resolved.path,
            featuredMediaId: featuredMediaId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.contents.id, row.dbId));

        const relations = categoryRelations.get(row.legacyId) ?? [];
        const termEntries: { termId: string; position: number }[] = [];
        for (const relation of relations) {
          const termId = await ctx.ids.find(tx, 'wp_terms', relation.termLegacyId, 'term');
          if (!termId) {
            await ctx.issues.record({
              severity: 'warning',
              stage: 'relations',
              code: 'item-import-failed',
              sourceTable: 'wp_term_relationships',
              sourceId: row.legacyId,
              detail: 'unresolved-term-reference',
            });
            continue;
          }
          termEntries.push({ termId, position: relation.position });
        }

        // Rigenerato dalla sorgente, come i blocchi (`importer-spec.md` §6.2):
        // si cancella e si riscrive l'insieme intero per questo contenuto,
        // cosi' un termine rimosso nella sorgente sparisce anche qui.
        await tx.delete(schema.contentTerms).where(eq(schema.contentTerms.contentId, row.dbId));
        for (const entry of termEntries) {
          await tx
            .insert(schema.contentTerms)
            .values({ contentId: row.dbId, termId: entry.termId, position: entry.position })
            .onConflictDoNothing();
        }

        return 'updated';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'relations',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );
  },
};
