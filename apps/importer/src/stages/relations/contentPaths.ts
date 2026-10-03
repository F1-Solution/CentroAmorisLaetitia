/**
 * Il calcolo dei percorsi di un'esecuzione, condiviso fra la fase `relations`,
 * che lo applica, e la verifica «contenuti senza percorso», che lo misura:
 * così le due non possono divergere su quali contenuti restano al percorso
 * provvisorio per decisione (DR-063, DR-064).
 */
import { schema } from '@amoris/db';
import type { StageContext } from '../context.js';
import type { SqlRow } from '../../source/sql/types.js';
import { resolvePaths, type PathNode, type ResolvedPath } from './paths.js';
import {
  hasEditorialWorkSince,
  isForced,
  lastSuccessfulRunFinishedAt,
} from '../contents/editorialProtection.js';

export interface ContentRow {
  readonly dbId: string;
  readonly legacyId: number;
  readonly type: 'page' | 'post';
  readonly slug: string;
  readonly path: string;
}

export interface ContentPathPlan {
  readonly resolvedPaths: ReadonlyMap<number, ResolvedPath>;
  /** I contenuti protetti dal lavoro redazionale, con il percorso che conservano. */
  readonly protectedPaths: ReadonlyMap<number, string>;
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function loadContentRows(ctx: StageContext): Promise<readonly ContentRow[]> {
  const rows = await ctx.tx
    .select({
      id: schema.contents.id,
      legacyId: schema.contents.legacyId,
      type: schema.contents.type,
      slug: schema.contents.slug,
      path: schema.contents.path,
    })
    .from(schema.contents);
  return rows
    .filter((r): r is typeof r & { legacyId: number } => r.legacyId !== null)
    .map((r) => ({
      dbId: r.id,
      legacyId: r.legacyId,
      type: r.type,
      slug: r.slug,
      path: r.path,
    }));
}

async function loadParentLegacyIds(ctx: StageContext): Promise<ReadonlyMap<number, number>> {
  const rows = await ctx.source.rows('wp_posts');
  const byId = new Map<number, number>();
  for (const row of rows as readonly SqlRow[]) {
    byId.set(asNumber(row['ID']), asNumber(row['post_parent']));
  }
  return byId;
}

export async function planContentPaths(
  ctx: StageContext,
  contentRows: readonly ContentRow[],
): Promise<ContentPathPlan> {
  const parentLegacyIds = await loadParentLegacyIds(ctx);
  const pathNodes: PathNode[] = contentRows.map((row) => ({
    legacyId: row.legacyId,
    dbId: row.dbId,
    type: row.type,
    slug: row.slug,
    parentLegacyId: parentLegacyIds.get(row.legacyId) ?? 0,
  }));
  const lastSuccessAt = await lastSuccessfulRunFinishedAt(ctx.tx);
  // I contenuti protetti non si riscrivono: il loro percorso attuale resta
  // occupato, e il calcolo delle collisioni deve saperlo prima di cominciare.
  const protectedPaths = new Map<number, string>();
  for (const row of contentRows) {
    const forced = isForced(ctx.options.forceContentIds, row.dbId, row.legacyId);
    if (!forced && (await hasEditorialWorkSince(ctx.tx, row.dbId, lastSuccessAt))) {
      protectedPaths.set(row.legacyId, row.path);
    }
  }
  return { resolvedPaths: resolvePaths(pathNodes, protectedPaths), protectedPaths };
}
