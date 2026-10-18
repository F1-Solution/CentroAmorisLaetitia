/**
 * Fase 8 `contents` (`importer-spec.md` §4, numerazione rifatta da DR-062): produce `contents` con i blocchi
 * convertiti. Non scrive `contents.parentId`, `contents.path` né
 * `contents.featuredMediaId`: sono la fase 9 `relations`
 * (`importer-spec.md` §4, riga `relations`). `path` è comunque `NOT NULL` e
 * unico nello schema (`packages/db/src/schema/content.ts`): questa fase
 * scrive un valore **provvisorio**, `/<slug>-<legacyId>/` (`relations/paths.ts`),
 * che `relations` sovrascrive con il percorso vero appena calcolato risalendo
 * la gerarchia (`wp-to-postgres-mapping.md` §3.1), tranne che per i contenuti
 * di DR-063 e DR-064, che restano bozze al percorso provvisorio.
 *
 * Sorgente: `wp_posts` con `post_type` in `('page', 'post')`
 * (`wp-to-postgres-mapping.md` §2): 78 pagine, 29 articoli pubblicati e 1
 * bozza. L'`auto-draft` si scarta (§2, riga `post`): non è un contenuto, è un
 * contenitore vuoto creato dall'editor.
 *
 * La conversione a blocchi passa da `convert/index.ts` (`1D-W3`) con **tutti e
 * quattro** i risolutori: `resolveMedia`, e dal 2026-09-24 anche
 * `resolveDocument`, `resolveSlider` e `resolveForm`. Li rende possibili
 * **DR-062**, che ha spostato `documents`, `sliders` e `forms` prima di questa
 * fase: finché giravano dopo, ogni riferimento a un modulo form diventava un
 * blocco `html` di riserva e la soglia di ADR-005 §3.4 misurava l'ordine delle
 * fasi invece della qualità della conversione (`BLOCK-MODEL.md` §10.4).
 */
import { databaseNow, schema } from '@amoris/db';
import {
  countReserveBlocks,
  extractContentText,
  serializeBlockDocument,
  type BlockDocument,
} from '@amoris/blocks/model';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import { convertContent, detectContentFamily } from '../../convert/index.js';
import type { SqlRow } from '../../source/sql/types.js';
import { buildMediaLookup, createMediaResolver } from './mediaResolver.js';
import {
  buildDocumentResolver,
  buildFormResolver,
  buildSliderResolver,
} from './entityResolvers.js';
import {
  applyMembersRestriction,
  buildPostMetaIndex,
  deriveGutterWidth,
  derivePageLayout,
  deriveShowTitle,
  parseStickyPostIds,
  parseTimestamp,
  publicationDateSource,
} from './meta.js';
import { writeHomeContentSetting } from './homePage.js';
import { expandCatposts } from './catposts.js';
import { writeThemeSettings } from './themeSettings.js';
import {
  hasEditorialWorkSince,
  isForced,
  lastSuccessfulRunFinishedAt,
} from './editorialProtection.js';
import { provisionalPath, resolveTreePaths } from '../relations/paths.js';
import { texturizePlain } from '../../convert/shared/wptexturize.js';
import { summarySource } from '../../convert/shared/summary-source.js';
import { metaDescriptionSource } from '../../convert/shared/meta-description.js';

interface SourceContent {
  readonly id: number;
  readonly type: 'page' | 'post';
  readonly status: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  /** `post_excerpt` senza `wptexturize`, per la description di All in One SEO (DR-180). */
  readonly rawExcerpt: string;
  readonly content: string;
  readonly authorLegacyId: number | null;
  readonly postDate: string;
  readonly modifiedDate: string;
  readonly position: number;
  readonly parentLegacyId: number;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number.parseInt(value, 10);
  return null;
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
      // `the_title` e `the_excerpt` della sorgente passavano da `wptexturize()` (DR-151).
      title: texturizePlain(asString(row['post_title'])),
      excerpt: texturizePlain(asString(row['post_excerpt'])),
      rawExcerpt: asString(row['post_excerpt']),
      content: asString(row['post_content']),
      authorLegacyId: asNumber(row['post_author']),
      postDate: publicationDateSource(asString(row['post_date_gmt']), asString(row['post_date'])),
      modifiedDate: publicationDateSource(
        asString(row['post_modified_gmt']),
        asString(row['post_modified']),
      ),
      position: asNumber(row['menu_order']) ?? 0,
      parentLegacyId: asNumber(row['post_parent']) ?? 0,
    });
  }
  return result;
}

/**
 * I contenuti che resteranno al percorso provvisorio (DR-063, DR-064), letti
 * dalla sorgente con lo stesso calcolo di `relations`: nascono già bozza, così
 * non sono pubblicati nemmeno se `relations` poi fallisse su di loro.
 */
function provisionalLegacyIds(rows: readonly SourceContent[]): ReadonlySet<number> {
  const resolved = resolveTreePaths(
    rows.map((row) => ({
      legacyId: row.id,
      type: row.type,
      slug: row.slug,
      parentLegacyId: row.parentLegacyId,
    })),
  );
  return new Set([...resolved].filter(([, entry]) => entry.provisional).map(([id]) => id));
}

export const contentsStage: Stage = {
  name: 'contents',
  // DR-062: `documents`, `sliders` e `forms` vengono prima, e i loro risolutori
  // devono esistere quando il convertitore incontra il riferimento.
  dependsOn: ['media', 'terms', 'documents', 'sliders', 'forms'],

  async expected(ctx: StageContext) {
    return (await loadSourceContents(ctx)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const rows = await loadSourceContents(ctx);
    const provisional = provisionalLegacyIds(rows);

    const mediaLookup = await buildMediaLookup(ctx.tx);
    const resolveMedia = createMediaResolver(mediaLookup);
    const [resolveDocument, resolveSlider, resolveForm] = await Promise.all([
      buildDocumentResolver(ctx.tx),
      buildSliderResolver(ctx.tx),
      buildFormResolver(ctx.tx),
    ]);

    const [postMetaRows, optionRows] = await Promise.all([
      ctx.source.rows('wp_postmeta'),
      ctx.source.rows('wp_options'),
    ]);
    const postMetaIndex = buildPostMetaIndex(postMetaRows as readonly SqlRow[]);
    // La miniatura di riserva di `[catposts]` è un allegato: si passa il suo file al risolutore dei media.
    const attachmentPath = (legacyId: string): string | null => {
      const file = postMetaIndex.get(Number(legacyId))?.get('_wp_attached_file');
      return file ? `/wp-content/uploads/${file}` : null;
    };
    const stickyOption = (optionRows as readonly SqlRow[]).find(
      (r) => asString(r['option_name']) === 'sticky_posts',
    );
    const stickyIds = parseStickyPostIds(
      stickyOption ? asString(stickyOption['option_value']) : undefined,
    );

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

        const meta = postMetaIndex.get(row.id) ?? new Map<string, string>();
        // Description dal testo dopo Members: una pagina riservata non espone né testo né estratto (privacy).
        const restricted = meta.has('_members_access_role');
        const descriptionSource = metaDescriptionSource({
          type: row.type,
          excerpt: restricted ? '' : row.rawExcerpt,
          content: applyMembersRestriction(row.content, meta),
        });
        const modifiedAt = parseTimestamp(row.modifiedDate);
        const { document } = convertContent({
          legacyContentId: row.id,
          postContent: applyMembersRestriction(
            expandCatposts(row.content, meta, attachmentPath),
            meta,
          ),
          resolvers: { resolveMedia, resolveDocument, resolveSlider, resolveForm },
        });
        const contentHtml = serializeBlockDocument(document);
        const contentText = extractContentText(contentHtml);
        // L'estratto della sorgente si conta sul testo grezzo, non su quello reso (D71, DR-155).
        const contentSummarySource = summarySource(row.content);
        // La famiglia d'origine si legge sul testo della sorgente, prima di Members e `[catposts]` (DR-136).
        const family = detectContentFamily(row.content);
        byFamily[family] += 1;
        documents.push(document);

        const showTitle = deriveShowTitle(meta, row.type);
        const pageLayout = derivePageLayout(meta, row.type);
        const gutterWidth = deriveGutterWidth(meta);
        const isSticky = stickyIds.has(row.id);

        const authorEntityId = row.authorLegacyId
          ? await ctx.ids.find(tx, 'wp_users', row.authorLegacyId, 'user')
          : null;
        const status = row.status === 'publish' && !provisional.has(row.id) ? 'published' : 'draft';
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
            pageLayout,
            gutterWidth,
            isSticky,
            excerpt: row.excerpt || null,
            blocks: document,
            contentHtml,
            contentText,
            summarySource: contentSummarySource,
            descriptionSource,
            publishedAt: publishedAt ?? undefined,
            modifiedAt,
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
              pageLayout,
              gutterWidth,
              isSticky,
              excerpt: row.excerpt || null,
              blocks: document,
              contentHtml,
              contentText,
              summarySource: contentSummarySource,
              descriptionSource,
              publishedAt: publishedAt ?? undefined,
              modifiedAt,
              authorId: authorEntityId,
              legacyId: row.id,
              legacyType: row.type,
              legacyFormat: family,
              updatedAt: databaseNow(),
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

    await writeHomeContentSetting(ctx, optionRows as readonly SqlRow[]);
    await writeThemeSettings(ctx, optionRows as readonly SqlRow[]);

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
