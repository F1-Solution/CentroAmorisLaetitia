/**
 * Fase 5 `contents` (`importer-spec.md` §4): produce `contents` con i blocchi
 * convertiti. Non scrive `contents.parentId`, `contents.path` né
 * `contents.featuredMediaId`: sono la fase 6 `relations`
 * (`importer-spec.md` §4, riga `relations`). `path` è comunque `NOT NULL` e
 * unico nello schema (`packages/db/src/schema/content.ts`): questa fase
 * scrive un valore **provvisorio**, `/<slug>/`, che `relations` sovrascrive
 * con il percorso vero appena calcolato risalendo la gerarchia
 * (`wp-to-postgres-mapping.md` §3.1).
 *
 * Sorgente: `wp_posts` con `post_type` in `('page', 'post')`
 * (`wp-to-postgres-mapping.md` §2): 78 pagine, 29 articoli pubblicati e 1
 * bozza. L'`auto-draft` si scarta (§2, riga `post`): non è un contenuto, è un
 * contenitore vuoto creato dall'editor.
 *
 * La conversione a blocchi passa da `convert/index.ts` (`1D-W3`), con un solo
 * risolutore reale disponibile in questa wave: `resolveMedia`, perché `media`
 * (fase 3) è già stata eseguita. `resolveForm`, `resolveDocument` e
 * `resolveSlider` restano assenti: le fasi che li producono (`forms`,
 * `documents`, `sliders`) sono fuori dal perimetro di questa wave
 * (`1D-W4d`/`1D-W5`). Ogni riferimento a un form diventa quindi un blocco
 * `html` di riserva — è un artefatto di questa wave, non un difetto della
 * conversione, e va riportato separatamente (`BLOCK-MODEL.md` §10.4).
 */
import { schema } from '@amoris/db';
import {
  countReserveBlocks,
  extractContentText,
  serializeBlockDocument,
  type BlockDocument,
} from '@amoris/blocks/model';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import { convertContent } from '../../convert/index.js';
import type { SqlRow } from '../../source/sql/types.js';
import { buildMediaLookup, createMediaResolver } from './mediaResolver.js';
import { buildPostMetaIndex, deriveShowTitle, parseStickyPostIds } from './meta.js';
import { hasEditorialWorkSince, isForced, lastSuccessfulRunFinishedAt } from './editorialProtection.js';

interface SourceContent {
  readonly id: number;
  readonly type: 'page' | 'post';
  readonly status: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly content: string;
  readonly authorLegacyId: number | null;
  readonly postDate: string;
  readonly position: number;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number.parseInt(value, 10);
  return null;
}

function parseTimestamp(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadSourceContents(ctx: StageContext): Promise<readonly SourceContent[]> {
  const rows = await ctx.source.rows('wp_posts');
  const result: SourceContent[] = [];
  for (const row of rows as readonly SqlRow[]) {
    const postType = asString(row['post_type']);
    if (postType !== 'page' && postType !== 'post') continue;
    const status = asString(row['post_status']);
    // L'`auto-draft` è un contenitore vuoto creato dall'editor, non un
    // contenuto (`wp-to-postgres-mapping.md` §2). Ogni altro stato non
    // documentato per `page`/`post` (per esempio `trash`) si scarta allo
    // stesso modo: non è previsto dalla sorgente misurata, e importarlo alla
    // cieca sarebbe inventare un contenuto.
    if (status !== 'publish' && status !== 'draft') continue;

    result.push({
      id: asNumber(row['ID']) ?? 0,
      type: postType,
      status,
      slug: asString(row['post_name']),
      title: asString(row['post_title']),
      excerpt: asString(row['post_excerpt']),
      content: asString(row['post_content']),
      authorLegacyId: asNumber(row['post_author']),
      postDate: asString(row['post_date']),
      position: asNumber(row['menu_order']) ?? 0,
    });
  }
  return result;
}

/**
 * Percorso provvisorio: `relations` (fase 6) lo sostituisce con quello vero,
 * calcolato risalendo la gerarchia (`wp-to-postgres-mapping.md` §3.1). Qui
 * serve solo un valore che soddisfi i vincoli dello schema (`NOT NULL`,
 * unico, forma) fino a quel momento.
 *
 * **Include sempre `legacyId`**, misurato necessario sulla sorgente reale:
 * due contenuti — un `post` e un altro con lo stesso `post_name` — condividono
 * lo stesso slug (WordPress non impone unicità dello slug fra `page` e `post`
 * come tipi diversi), e uno slug vuoto (una bozza di lavoro mai salvata con
 * uno slug) produrrebbe `//`, che non rispetta `contents_path_shape`.
 * `legacyId` è unico per costruzione: elimina entrambi i casi senza inventare
 * un percorso che assomigli a quello vero, che è compito di `relations`.
 */
function provisionalPath(slug: string, legacyId: number): string {
  const base = slug || 'senza-slug';
  return `/${base}-${legacyId}/`;
}

export const contentsStage: Stage = {
  name: 'contents',
  dependsOn: ['media', 'terms'],

  async expected(ctx: StageContext) {
    return (await loadSourceContents(ctx)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const rows = await loadSourceContents(ctx);

    const mediaLookup = await buildMediaLookup(ctx.tx);
    const resolveMedia = createMediaResolver(mediaLookup);

    const [postMetaRows, optionRows] = await Promise.all([
      ctx.source.rows('wp_postmeta'),
      ctx.source.rows('wp_options'),
    ]);
    const postMetaIndex = buildPostMetaIndex(postMetaRows as readonly SqlRow[]);
    const stickyOption = (optionRows as readonly SqlRow[]).find((r) => asString(r['option_name']) === 'sticky_posts');
    const stickyIds = parseStickyPostIds(stickyOption ? asString(stickyOption['option_value']) : undefined);

    // Letta una sola volta, prima del ciclo: è la stessa per ogni elemento di
    // questa esecuzione (`editorialProtection.ts`).
    const lastSuccessAt = await lastSuccessfulRunFinishedAt(ctx.tx);

    // Le due sezioni del rapporto che solo questa fase puo' misurare
    // (`importer-spec.md` §8.1, §6.3 punto 3). Si raccolgono qui perche'
    // dopo la transazione i documenti convertiti non esistono piu' in `plan`.
    const byFamily = { gutenberg: 0, divi: 0, html: 0 };
    const documents: BlockDocument[] = [];
    const skippedForEditorialWork: string[] = [];

    const result = await forEachItem(
      ctx.tx,
      rows,
      (row): ItemKey => ({ sourceTable: 'wp_posts', sourceId: row.id }),
      async (row, tx) => {
        const existingId = await ctx.ids.find(tx, 'wp_posts', row.id, 'content');
        const forced = isForced(ctx.options.forceContentIds, existingId, row.id);

        if (!forced && (await hasEditorialWorkSince(tx, existingId, lastSuccessAt))) {
          await ctx.issues.record({
            severity: 'warning',
            stage: 'contents',
            code: 'editorial-work-protected',
            sourceTable: 'wp_posts',
            sourceId: row.id,
            detail: existingId,
          });
          // `existingId` non è mai nullo qui: `hasEditorialWorkSince`
          // restituisce falso quando lo è.
          if (existingId) skippedForEditorialWork.push(existingId);
          return 'skipped';
        }

        const { document, family } = convertContent({
          legacyContentId: row.id,
          postContent: row.content,
          resolvers: { resolveMedia },
        });
        const contentHtml = serializeBlockDocument(document);
        const contentText = extractContentText(contentHtml);
        byFamily[family] += 1;
        documents.push(document);

        const meta = postMetaIndex.get(row.id) ?? new Map<string, string>();
        const showTitle = deriveShowTitle(meta);
        const isSticky = stickyIds.has(row.id);

        const authorEntityId = row.authorLegacyId
          ? await ctx.ids.find(tx, 'wp_users', row.authorLegacyId, 'user')
          : null;
        const status = row.status === 'publish' ? 'published' : 'draft';
        const publishedAt = status === 'published' ? parseTimestamp(row.postDate) : null;

        const [written] = await tx
          .insert(schema.contents)
          .values({
            id: existingId ?? undefined,
            type: row.type,
            status,
            slug: row.slug,
            path: provisionalPath(row.slug, row.id),
            position: row.position,
            title: row.title,
            showTitle,
            isSticky,
            excerpt: row.excerpt || null,
            blocks: document,
            contentHtml,
            contentText,
            publishedAt: publishedAt ?? undefined,
            authorId: authorEntityId,
            legacyId: row.id,
            legacyType: row.type,
            legacyFormat: family,
          })
          .onConflictDoUpdate({
            target: schema.contents.id,
            set: {
              type: row.type,
              status,
              slug: row.slug,
              position: row.position,
              title: row.title,
              showTitle,
              isSticky,
              excerpt: row.excerpt || null,
              blocks: document,
              contentHtml,
              contentText,
              publishedAt: publishedAt ?? undefined,
              authorId: authorEntityId,
              legacyId: row.id,
              legacyType: row.type,
              legacyFormat: family,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.contents.id });

        if (!written) throw new Error('inserimento di contents non ha restituito una riga');

        await ctx.ids.remember(
          tx,
          'wp_posts',
          row.id,
          'content',
          written.id,
          ctx.mode === 'apply' ? ctx.runId : null,
          existingId ? 'updated' : 'created',
        );

        return existingId ? 'updated' : 'created';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'contents',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );

    // La soglia si calcola con la funzione di `@amoris/blocks`
    // (`BLOCK-MODEL.md` §8), non con un secondo conteggio scritto qui: due
    // conteggi della stessa cosa divergono.
    const reserve = countReserveBlocks(documents);
    const blocksTotal = documents.reduce((sum, doc) => sum + countAllBlocks(doc.blocks), 0);

    return {
      ...result,
      skippedForEditorialWork,
      conversion: {
        gutenberg: byFamily.gutenberg,
        divi: byFamily.divi,
        html: byFamily.html,
        blocksTotal,
        blocksNonContainer: reserve.nonContainerBlocks,
        fallbackBlocks: reserve.htmlBlocks,
        fallbackPercent: reserve.percentage,
        fallbackByReason: reserve.byReason,
        contentsWithFallback: reserve.touchedContents,
        thresholdPercentOk: !reserve.exceedsPercentageThreshold,
        thresholdContentsOk: !reserve.exceedsContentThreshold,
      },
    };
  },
};

/** Tutti i blocchi, contenitori compresi: è la riga «blocchi prodotti» di `importer-spec.md` §8.1. */
function countAllBlocks(nodes: BlockDocument['blocks']): number {
  let total = 0;
  for (const node of nodes) {
    total += 1 + countAllBlocks(node.children);
  }
  return total;
}
