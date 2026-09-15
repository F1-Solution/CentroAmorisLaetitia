/**
 * Calcolo di `contents.path` e `contents.parentId`
 * (`wp-to-postgres-mapping.md` §3.1): risalendo `post_parent` fino alla
 * radice, con la struttura di permalink `/%postname%/`. Funzione pura:
 * riceve i contenuti già creati dalla fase `contents` (con il loro
 * `legacy_id` e `id` di destinazione) e il grafo dei genitori letto dalla
 * sorgente, e restituisce percorso e genitore per ciascuno.
 *
 * Gli articoli non hanno genitore
 * (`packages/db/src/schema/content.ts`, vincolo `contents_posts_have_no_parent`):
 * il loro percorso è sempre `/<slug>/`, come una pagina di radice.
 */
export interface PathNode {
  readonly legacyId: number;
  readonly dbId: string;
  readonly type: 'page' | 'post';
  readonly slug: string;
  /** `wp_posts.post_parent`. `0` = nessun genitore. Ignorato per `type === 'post'`. */
  readonly parentLegacyId: number;
}

export interface ResolvedPath {
  readonly parentDbId: string | null;
  readonly path: string;
}

/** Radici prima dei figli, cosi' il genitore ha gia' il proprio percorso calcolato. */
function orderByDepth(nodes: readonly PathNode[]): readonly PathNode[] {
  const byLegacyId = new Map(nodes.map((n) => [n.legacyId, n]));
  const depthOf = (node: PathNode, seen: ReadonlySet<number> = new Set()): number => {
    if (node.type === 'post' || node.parentLegacyId === 0 || seen.has(node.legacyId)) return 0;
    const parent = byLegacyId.get(node.parentLegacyId);
    if (!parent) return 0;
    return 1 + depthOf(parent, new Set([...seen, node.legacyId]));
  };
  return [...nodes].sort((a, b) => depthOf(a) - depthOf(b));
}

export function resolvePaths(nodes: readonly PathNode[]): ReadonlyMap<number, ResolvedPath> {
  const resolved = new Map<number, ResolvedPath>();
  const byLegacyId = new Map(nodes.map((n) => [n.legacyId, n]));

  for (const node of orderByDepth(nodes)) {
    if (node.type === 'post' || node.parentLegacyId === 0 || !byLegacyId.has(node.parentLegacyId)) {
      resolved.set(node.legacyId, { parentDbId: null, path: `/${node.slug}/` });
      continue;
    }
    const parent = resolved.get(node.parentLegacyId);
    if (!parent) {
      // Il genitore esiste nella sorgente ma non è stato risolto prima di
      // questo figlio (per esempio un ciclo): trattato come radice, e
      // l'anomalia resta visibile nel percorso stesso, che non annida nulla.
      resolved.set(node.legacyId, { parentDbId: null, path: `/${node.slug}/` });
      continue;
    }
    const parentInfo = byLegacyId.get(node.parentLegacyId);
    resolved.set(node.legacyId, {
      parentDbId: parentInfo?.dbId ?? null,
      path: `${parent.path.slice(0, -1)}/${node.slug}/`,
    });
  }

  return resolved;
}
