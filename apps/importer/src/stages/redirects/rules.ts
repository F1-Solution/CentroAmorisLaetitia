/**
 * Le quattro famiglie di `redirects` (`wp-to-postgres-mapping.md` §3.2, §3.3;
 * ADR-004 §3.4): calcolate risalendo `import_id_map` e le tabelle già
 * importate (`media`, `contents`, `documents`), mai da un elenco scritto a
 * mano. Un candidato che non trova la propria destinazione resta con
 * `targetPath: null` e la fase lo registra come anomalia invece di scriverlo
 * (`importer-spec.md` §7).
 */
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { StageContext } from '../context.js';
import type { ItemKey } from '../types.js';
import type { SqlRow } from '../../source/sql/types.js';

export type RedirectKind = 'exact' | 'prefix';

export interface RedirectCandidate {
  readonly key: ItemKey;
  readonly sourcePath: string;
  readonly targetPath: string | null;
  readonly kind: RedirectKind;
  readonly note: string;
  /** Vocabolario chiuso, mai un frammento di contenuto — coerente con `ItemKey`. */
  readonly unresolvedReason: 'unresolved-media' | 'unresolved-content' | null;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

/** `/segmento/` normalizzato: un solo slash iniziale e finale, mai vuoto. */
function toPath(segment: string): string {
  const trimmed = segment.replace(/^\/+|\/+$/g, '');
  return `/${trimmed}/`;
}

async function loadContentPathsByLegacyId(ctx: StageContext): Promise<ReadonlyMap<number, string>> {
  const rows = await ctx.tx
    .select({ legacyId: schema.contents.legacyId, path: schema.contents.path })
    .from(schema.contents);
  const byLegacyId = new Map<number, string>();
  for (const row of rows) {
    if (row.legacyId !== null) byLegacyId.set(row.legacyId, row.path);
  }
  return byLegacyId;
}

async function loadMediaPublicPathsByLegacyId(
  ctx: StageContext,
): Promise<ReadonlyMap<number, string>> {
  const rows = await ctx.tx
    .select({ legacyId: schema.media.legacyId, publicPath: schema.media.publicPath })
    .from(schema.media);
  const byLegacyId = new Map<number, string>();
  for (const row of rows) {
    if (row.legacyId !== null) byLegacyId.set(row.legacyId, row.publicPath);
  }
  return byLegacyId;
}

/**
 * Famiglia 1 — pagine allegato → file (`wp-to-postgres-mapping.md` §3.2):
 * 169 righe attese su 170 allegati, perché una non trova una riga `media`
 * risolta (§11.7, misurato). Il percorso sorgente segue la stessa regola di
 * `relations/paths.ts`: genitore risolto più lo slug dell'allegato.
 */
async function buildAttachmentPageCandidates(ctx: StageContext): Promise<RedirectCandidate[]> {
  const postRows = (await ctx.source.rows('wp_posts')) as readonly SqlRow[];
  const attachments = postRows.filter(
    (row) =>
      asString(row['post_type']) === 'attachment' && asString(row['post_status']) === 'inherit',
  );
  const contentPaths = await loadContentPathsByLegacyId(ctx);
  const mediaPaths = await loadMediaPublicPathsByLegacyId(ctx);

  const candidates: RedirectCandidate[] = [];
  for (const row of attachments) {
    const attachmentId = asNumber(row['ID']);
    const slug = asString(row['post_name']);
    const parentId = asNumber(row['post_parent']);
    const parentPath = parentId === 0 ? null : (contentPaths.get(parentId) ?? null);
    const sourcePath = parentPath ? `${parentPath.slice(0, -1)}/${slug}/` : toPath(slug);

    const targetPath = mediaPaths.get(attachmentId) ?? null;
    candidates.push({
      key: { sourceTable: 'wp_posts', sourceId: attachmentId },
      sourcePath,
      targetPath,
      kind: 'exact',
      note: 'pagina allegato',
      unresolvedReason: targetPath ? null : 'unresolved-media',
    });
  }
  return candidates;
}

/**
 * Famiglia 2 — documenti `wpdmpro` → `/download/<slug>/` (4 righe attese).
 * I 4 documenti riservati (`cuar_private_file`) non hanno mai avuto un URL
 * pubblico e non producono redirect (`wp-to-postgres-mapping.md` §3.2).
 */
async function buildDocumentCandidates(ctx: StageContext): Promise<RedirectCandidate[]> {
  const rows = await ctx.tx
    .select({ legacyId: schema.documents.legacyId, slug: schema.documents.slug })
    .from(schema.documents)
    .where(eq(schema.documents.legacySource, 'wpdmpro'));

  return rows
    .filter((row): row is typeof row & { legacyId: number } => row.legacyId !== null)
    .map((row) => ({
      key: { sourceTable: 'documents', sourceId: row.legacyId },
      sourcePath: toPath(row.slug),
      targetPath: `/download/${row.slug}/`,
      kind: 'exact' as const,
      note: 'documento wpdmpro',
      unresolvedReason: null,
    }));
}

/**
 * Famiglia 3 — `/wp-content/uploads/` → `/media/` (ADR-004 §3.4): una sola
 * regola con carattere jolly, non 1.546. Non deriva da alcuna riga sorgente:
 * è la stessa struttura di percorso che la fase `rewrite` applica ai
 * riferimenti interni.
 */
function buildUploadsPrefixCandidate(): RedirectCandidate {
  return {
    key: { sourceTable: 'config', sourceId: 0 },
    sourcePath: '/wp-content/uploads/',
    targetPath: '/media/',
    kind: 'prefix',
    note: 'percorsi storici dei media',
    unresolvedReason: null,
  };
}

/**
 * Famiglia 4 — slug storici → contenuto attuale (`wp-to-postgres-mapping.md`
 * §3.3): `_wp_old_slug` ha 7 righe, una delle quali (un `wpforms`) non ha un
 * contenuto pubblicato dietro e si scarta.
 */
async function buildOldSlugCandidates(ctx: StageContext): Promise<RedirectCandidate[]> {
  const metaRows = (await ctx.source.rows('wp_postmeta')) as readonly SqlRow[];
  const oldSlugRows = metaRows.filter((row) => asString(row['meta_key']) === '_wp_old_slug');
  const contentPaths = await loadContentPathsByLegacyId(ctx);

  return oldSlugRows.map((row) => {
    const postId = asNumber(row['post_id']);
    const oldSlug = asString(row['meta_value']);
    const targetPath = contentPaths.get(postId) ?? null;
    return {
      key: { sourceTable: 'wp_postmeta', sourceId: postId },
      sourcePath: toPath(oldSlug),
      targetPath,
      kind: 'exact' as const,
      note: 'slug storico',
      unresolvedReason: targetPath ? null : ('unresolved-content' as const),
    };
  });
}

export async function buildRedirectCandidates(
  ctx: StageContext,
): Promise<readonly RedirectCandidate[]> {
  const [attachmentPages, documents, oldSlugs] = await Promise.all([
    buildAttachmentPageCandidates(ctx),
    buildDocumentCandidates(ctx),
    buildOldSlugCandidates(ctx),
  ]);
  return [...attachmentPages, ...documents, buildUploadsPrefixCandidate(), ...oldSlugs];
}
