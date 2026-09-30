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
 *
 * Due anomalie della sorgente ricevono il percorso provvisorio invece di
 * quello vero, e restano bozze: lo slug vuoto (DR-064) e il percorso già
 * assegnato a un altro contenuto (DR-063), dove conserva l'indirizzo la
 * pagina, e fra due dello stesso tipo il contenuto più vecchio.
 */
export interface PathSourceNode {
  readonly legacyId: number;
  readonly type: 'page' | 'post';
  readonly slug: string;
  /** `wp_posts.post_parent`. `0` = nessun genitore. Ignorato per `type === 'post'`. */
  readonly parentLegacyId: number;
}

export interface PathNode extends PathSourceNode {
  readonly dbId: string;
}

export type ProvisionalReason = 'empty-slug' | 'path-collision';

export interface ResolvedPath {
  readonly parentDbId: string | null;
  readonly path: string;
  /** Non nullo quando il contenuto resta al percorso provvisorio, e quindi bozza. */
  readonly provisional: ProvisionalReason | null;
}

/**
 * Percorso provvisorio: include sempre `legacyId`, unico per costruzione, così
 * non somiglia a nessun indirizzo vero e non collide (DR-063, DR-064).
 */
export function provisionalPath(slug: string, legacyId: number): string {
  const base = slug || 'senza-slug';
  return `/${base}-${legacyId}/`;
}

/**
 * Radici prima dei figli, così il genitore ha già il proprio percorso; a
 * parità di profondità le pagine prima degli articoli e i più vecchi prima,
 * che è l'ordine in cui si assegna un percorso conteso.
 */
function orderForAssignment<T extends PathSourceNode>(nodes: readonly T[]): readonly T[] {
  const byLegacyId = new Map(nodes.map((n) => [n.legacyId, n]));
  const depthOf = (node: T, seen: ReadonlySet<number> = new Set()): number => {
    if (node.type === 'post' || node.parentLegacyId === 0 || seen.has(node.legacyId)) return 0;
    const parent = byLegacyId.get(node.parentLegacyId);
    if (!parent) return 0;
    return 1 + depthOf(parent, new Set([...seen, node.legacyId]));
  };
  const typeRank = (node: T): number => (node.type === 'page' ? 0 : 1);
  return [...nodes].sort(
    (a, b) => depthOf(a) - depthOf(b) || typeRank(a) - typeRank(b) || a.legacyId - b.legacyId,
  );
}

interface TreePath {
  readonly parentLegacyId: number | null;
  readonly path: string;
  readonly provisional: ProvisionalReason | null;
}

/**
 * Il calcolo vero e proprio, sui soli dati della sorgente: lo usa anche la fase
 * `contents`. `reserved` sono i percorsi dei contenuti che non si riscrivono,
 * perché protetti dal lavoro redazionale: restano loro e nessun altro li riceve.
 */
export function resolveTreePaths(
  nodes: readonly PathSourceNode[],
  reserved: ReadonlyMap<number, string> = new Map(),
): ReadonlyMap<number, TreePath> {
  const resolved = new Map<number, TreePath>();
  const byLegacyId = new Map(nodes.map((n) => [n.legacyId, n]));
  const taken = new Set<string>(reserved.values());

  for (const node of orderForAssignment(nodes)) {
    const hasParent =
      node.type !== 'post' && node.parentLegacyId !== 0 && byLegacyId.has(node.parentLegacyId);
    // Il genitore esiste nella sorgente ma non è stato risolto prima di
    // questo figlio (per esempio un ciclo): trattato come radice, e
    // l'anomalia resta visibile nel percorso stesso, che non annida nulla.
    const parent = hasParent ? resolved.get(node.parentLegacyId) : undefined;
    const parentLegacyId = parent ? node.parentLegacyId : null;
    const base = parent ? parent.path.slice(0, -1) : '';

    const reservedPath = reserved.get(node.legacyId);
    let entry: TreePath;
    if (reservedPath !== undefined) {
      entry = { parentLegacyId, path: reservedPath, provisional: null };
    } else if (node.slug === '') {
      entry = {
        parentLegacyId,
        path: provisionalPath('', node.legacyId),
        provisional: 'empty-slug',
      };
    } else if (taken.has(`${base}/${node.slug}/`)) {
      entry = {
        parentLegacyId,
        path: provisionalPath(node.slug, node.legacyId),
        provisional: 'path-collision',
      };
    } else {
      entry = { parentLegacyId, path: `${base}/${node.slug}/`, provisional: null };
    }
    taken.add(entry.path);
    resolved.set(node.legacyId, entry);
  }

  return resolved;
}

export function resolvePaths(
  nodes: readonly PathNode[],
  reserved: ReadonlyMap<number, string> = new Map(),
): ReadonlyMap<number, ResolvedPath> {
  const dbIdByLegacyId = new Map(nodes.map((n) => [n.legacyId, n.dbId]));
  const resolved = new Map<number, ResolvedPath>();
  for (const [legacyId, entry] of resolveTreePaths(nodes, reserved)) {
    resolved.set(legacyId, {
      parentDbId:
        entry.parentLegacyId === null ? null : (dbIdByLegacyId.get(entry.parentLegacyId) ?? null),
      path: entry.path,
      provisional: entry.provisional,
    });
  }
  return resolved;
}
