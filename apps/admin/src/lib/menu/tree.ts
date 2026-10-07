/**
 * Albero delle voci di menu: struttura e spostamenti.
 *
 * Il servizio conserva le voci **piatte**, con genitore e posizione; l'albero
 * esiste solo a schermo. Qui stanno le sole funzioni pure che lo costruiscono e
 * lo modificano, separate dalla schermata per una ragione pratica: annidare e
 * spostare sono le operazioni che il criterio 1D-32 chiede, e si provano meglio
 * su un elenco che dentro un componente.
 *
 * Dopo ogni spostamento le posizioni si **rinumerano fra fratelli**, da zero.
 * È l'unica convenzione che rende l'ordine ricostruibile raggruppando per
 * genitore, e toglie di mezzo i buchi che l'import lascia.
 */
import type { DropZone } from '@amoris/ui';

export interface FlatMenuItem {
  readonly id: string;
  readonly parentId: string | null;
  readonly position: number;
}

export interface MenuNode<T extends FlatMenuItem> {
  readonly item: T;
  readonly children: readonly MenuNode<T>[];
}

/** Modifica da mandare al servizio: solo ciò che è davvero cambiato. */
export interface MenuPatch {
  readonly id: string;
  readonly parentId: string | null;
  readonly position: number;
}

export function buildTree<T extends FlatMenuItem>(items: readonly T[]): MenuNode<T>[] {
  const byParent = new Map<string | null, T[]>();
  for (const item of items) {
    const siblings = byParent.get(item.parentId) ?? [];
    siblings.push(item);
    byParent.set(item.parentId, siblings);
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.position - b.position);

  // Un genitore mancante — voce cancellata, dati incoerenti — non deve far
  // sparire i figli dall'elenco: risalgono alla radice invece di svanire.
  const known = new Set(items.map((item) => item.id));
  const roots = [...(byParent.get(null) ?? [])];
  for (const item of items) {
    if (item.parentId !== null && !known.has(item.parentId)) roots.push(item);
  }
  roots.sort((a, b) => a.position - b.position);

  const build = (item: T): MenuNode<T> => ({
    item,
    children: (byParent.get(item.id) ?? []).map(build),
  });

  return roots.map(build);
}

/** Percorso dalla radice alla voce, estremi compresi. Vuoto se la voce non c'è. */
function pathTo<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  id: string,
): MenuNode<T>[] | null {
  for (const node of nodes) {
    if (node.item.id === id) return [node];
    const deeper = pathTo(node.children, id);
    if (deeper) return [node, ...deeper];
  }
  return null;
}

interface Placement<T extends FlatMenuItem> {
  readonly parentId: string | null;
  readonly siblings: readonly MenuNode<T>[];
  readonly index: number;
}

function placementOf<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  id: string,
): Placement<T> | null {
  const path = pathTo(nodes, id);
  if (!path) return null;
  const parent = path.length >= 2 ? path[path.length - 2] : undefined;
  const siblings = parent ? parent.children : nodes;
  return {
    parentId: parent?.item.id ?? null,
    siblings,
    index: siblings.findIndex((node) => node.item.id === id),
  };
}

/** Elenco piatto in ordine di profondità, con genitore e posizione rinumerati. */
export function flatten<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  parentId: string | null = null,
): MenuPatch[] {
  return nodes.flatMap((node, index) => [
    { id: node.item.id, parentId, position: index },
    ...flatten(node.children, node.item.id),
  ]);
}

/** Le sole voci la cui collocazione è cambiata: nessuna scrittura inutile. */
export function patchesFor<T extends FlatMenuItem>(
  before: readonly T[],
  after: readonly MenuNode<T>[],
): MenuPatch[] {
  const previous = new Map(before.map((item) => [item.id, item]));
  return flatten(after).filter((patch) => {
    const was = previous.get(patch.id);
    return !was || was.parentId !== patch.parentId || was.position !== patch.position;
  });
}

function replaceChildren<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  parentId: string | null,
  next: readonly MenuNode<T>[],
): MenuNode<T>[] {
  if (parentId === null) return [...next];
  return nodes.map((node) =>
    node.item.id === parentId
      ? { ...node, children: next }
      : { ...node, children: replaceChildren(node.children, parentId, next) },
  );
}

function swap<T>(list: readonly T[], a: number, b: number): T[] {
  const copy = [...list];
  const first = copy[a];
  const second = copy[b];
  if (first === undefined || second === undefined) return copy;
  copy[a] = second;
  copy[b] = first;
  return copy;
}

function removeFrom<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  id: string,
): MenuNode<T>[] {
  return nodes
    .filter((node) => node.item.id !== id)
    .map((node) => ({ ...node, children: removeFrom(node.children, id) }));
}

export function moveUp<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  id: string,
): MenuNode<T>[] {
  const where = placementOf(nodes, id);
  if (!where || where.index <= 0) return [...nodes];
  return replaceChildren(nodes, where.parentId, swap(where.siblings, where.index, where.index - 1));
}

export function moveDown<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  id: string,
): MenuNode<T>[] {
  const where = placementOf(nodes, id);
  if (!where || where.index < 0 || where.index >= where.siblings.length - 1) return [...nodes];
  return replaceChildren(nodes, where.parentId, swap(where.siblings, where.index, where.index + 1));
}

/** Annida la voce sotto la sorella che la precede, in coda ai suoi figli. */
export function indent<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  id: string,
): MenuNode<T>[] {
  const where = placementOf(nodes, id);
  if (!where || where.index <= 0) return [...nodes];
  const moving = where.siblings[where.index];
  const newParent = where.siblings[where.index - 1];
  if (!moving || !newParent) return [...nodes];

  const siblings = where.siblings.filter((_, index) => index !== where.index);
  const withChild = siblings.map((node) =>
    node.item.id === newParent.item.id ? { ...node, children: [...node.children, moving] } : node,
  );
  return replaceChildren(nodes, where.parentId, withChild);
}

/** Riporta la voce al livello del genitore, subito dopo di lui. */
export function outdent<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  id: string,
): MenuNode<T>[] {
  const path = pathTo(nodes, id);
  if (!path || path.length < 2) return [...nodes];
  const moving = path[path.length - 1];
  const parent = path[path.length - 2];
  if (!moving || !parent) return [...nodes];

  const withoutMoving = removeFrom(nodes, id);
  const grandparent = placementOf(withoutMoving, parent.item.id);
  if (!grandparent) return [...nodes];

  const siblings = [...grandparent.siblings];
  siblings.splice(grandparent.index + 1, 0, moving);
  return replaceChildren(withoutMoving, grandparent.parentId, siblings);
}

function contains<T extends FlatMenuItem>(node: MenuNode<T>, id: string): boolean {
  return node.item.id === id || node.children.some((child) => contains(child, id));
}

/**
 * Trascinamento (DR-082): porta la voce dentro quella di arrivo, in coda ai suoi
 * figli, oppure accanto, prima o dopo. `null` se il rilascio non è ammesso.
 */
export function moveItemTo<T extends FlatMenuItem>(
  nodes: readonly MenuNode<T>[],
  activeId: string,
  targetId: string,
  zone: DropZone,
): MenuNode<T>[] | null {
  const moving = pathTo(nodes, activeId)?.at(-1);
  if (!moving || contains(moving, targetId)) return null;

  const without = removeFrom(nodes, activeId);
  if (zone === 'inside') {
    const target = pathTo(without, targetId)?.at(-1);
    if (!target) return null;
    return replaceChildren(without, targetId, [...target.children, moving]);
  }
  const where = placementOf(without, targetId);
  if (!where) return null;
  const siblings = [...where.siblings];
  siblings.splice(zone === 'before' ? where.index : where.index + 1, 0, moving);
  return replaceChildren(without, where.parentId, siblings);
}
