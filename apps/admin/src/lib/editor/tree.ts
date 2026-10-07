/**
 * Operazioni sull'albero dei blocchi, tutte **immutabili**: ogni funzione
 * restituisce un documento nuovo e non tocca quello ricevuto.
 *
 * Non è un capriccio di stile. Il criterio 1D-36 — aprire un contenuto e
 * salvarlo senza modifiche non cambia nulla — si dimostra confrontando ciò che
 * si è letto con ciò che si sta per scrivere: se una funzione modificasse
 * l'originale, il confronto sarebbe fra due riferimenti allo stesso oggetto e
 * direbbe sempre «uguale», anche quando non lo è.
 *
 * Il perimetro è quello di ADR-006 §3.2: aggiungere ed eliminare blocchi,
 * spostarli dentro o accanto a un altro blocco dove il tipo è ammesso (DR-097),
 * e cambiare la ripartizione delle colonne di una riga. Nient'altro.
 */
import {
  ALLOWED_CHILDREN,
  ROOT_ALLOWED_TYPES,
  extractContentText,
  generateAdminBlockId,
  htmlPropsSchema,
  mediaTextPropsSchema,
  postListPropsSchema,
  richTextPropsSchema,
  separatorPropsSchema,
  type BlockDocument,
  type BlockNode as ModelBlock,
  type BlockType,
} from '@amoris/blocks';
import type { DropZone, BlockNode as TreeNode } from '@amoris/ui';

/**
 * I tipi che si possono creare da zero in questa wave. Gli altri sei non sono
 * dimenticati: `form`, `document` e `slider` richiedono l'identificatore di una
 * riga che l'editor non sa ancora scegliere, `image` un media, `video` una
 * sorgente e `map` un indirizzo con le coordinate. Crearli con un segnaposto
 * significherebbe inventare un dato, e lo schema di `packages/blocks` li
 * rifiuterebbe comunque.
 */
export const CREATABLE_TYPES: readonly BlockType[] = [
  'rich_text',
  'separator',
  'html',
  'media_text',
  'post_list',
];

export const UNCREATABLE_REASON =
  'Immagine, video, mappa, modulo, documento e presentazione rimandano a qualcosa che già esiste: si potranno inserire quando la schermata dei media e quella dei moduli esisteranno. I blocchi di questi tipi già presenti nella pagina si modificano normalmente.';

/** Che cosa si può inserire dentro `parentId`. `null` è la radice del documento. */
export function allowedChildTypes(
  doc: BlockDocument,
  parentId: string | null,
): readonly BlockType[] {
  if (parentId === null) return ROOT_ALLOWED_TYPES;
  const parent = findBlock(doc.blocks, parentId);
  return parent ? ALLOWED_CHILDREN[parent.type] : [];
}

export function creatableChildTypes(
  doc: BlockDocument,
  parentId: string | null,
): readonly BlockType[] {
  const allowed = allowedChildTypes(doc, parentId);
  return CREATABLE_TYPES.filter((type) => allowed.includes(type));
}

export function findBlock(blocks: readonly ModelBlock[], id: string): ModelBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    const inChildren = findBlock(block.children, id);
    if (inChildren) return inChildren;
  }
  return null;
}

/** `null` quando il blocco sta nella radice; `undefined` quando non esiste. */
export function parentIdOf(
  blocks: readonly ModelBlock[],
  id: string,
  current: string | null = null,
): string | null | undefined {
  for (const block of blocks) {
    if (block.id === id) return current;
    const found = parentIdOf(block.children, id, block.id);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function siblingsOf(doc: BlockDocument, parentId: string | null): readonly ModelBlock[] {
  if (parentId === null) return doc.blocks;
  return findBlock(doc.blocks, parentId)?.children ?? [];
}

/**
 * Riscrive l'elenco dei figli di `parentId` con `next`. È il punto unico da cui
 * passano spostamento, inserimento ed eliminazione: un solo posto in cui la
 * copia può sbagliarsi.
 */
function withChildren(
  blocks: readonly ModelBlock[],
  parentId: string,
  next: (children: readonly ModelBlock[]) => readonly ModelBlock[],
): ModelBlock[] {
  return blocks.map((block) => {
    if (block.id === parentId) {
      return { ...block, children: [...next(block.children)] } as ModelBlock;
    }
    if (block.children.length === 0) return block;
    return { ...block, children: withChildren(block.children, parentId, next) } as ModelBlock;
  });
}

function replaceSiblings(
  doc: BlockDocument,
  parentId: string | null,
  next: (children: readonly ModelBlock[]) => readonly ModelBlock[],
): BlockDocument {
  if (parentId === null) return { ...doc, blocks: [...next(doc.blocks)] };
  return { ...doc, blocks: withChildren(doc.blocks, parentId, next) };
}

function moved<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  if (item === undefined) return [...items];
  copy.splice(to, 0, item);
  return copy;
}

/**
 * Sposta un blocco fra i suoi fratelli. Un blocco **non cambia contenitore**:
 * ADR-006 §3.2 limita lo spostamento a «dentro una colonna», e DR-069 ha
 * deciso il **gesto**, non il perimetro.
 */
export function moveBlock(doc: BlockDocument, id: string, toIndex: number): BlockDocument {
  const parentId = parentIdOf(doc.blocks, id);
  if (parentId === undefined) return doc;
  const siblings = siblingsOf(doc, parentId);
  const fromIndex = siblings.findIndex((block) => block.id === id);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= siblings.length || toIndex === fromIndex) {
    return doc;
  }
  return syncColumnStructure(
    replaceSiblings(doc, parentId, (children) => moved(children, fromIndex, toIndex)),
    parentId,
  );
}

/**
 * Dopo un riordino delle colonne, `columnStructure` della riga segue il nuovo
 * ordine delle larghezze: è l'invariante di `BLOCK-MODEL.md` §3.2.
 */
function syncColumnStructure(doc: BlockDocument, parentId: string | null): BlockDocument {
  if (parentId === null) return doc;
  const row = findBlock(doc.blocks, parentId);
  if (!row || row.type !== 'row') return doc;
  const structure = row.children
    .map((child) => (child.type === 'column' ? child.props.width : null))
    .filter((width): width is string => width !== null)
    .join(',');
  if (structure === row.props.columnStructure) return doc;
  return replaceBlock(doc, { ...row, props: { ...row.props, columnStructure: structure } });
}

export function moveBlockBy(doc: BlockDocument, id: string, delta: number): BlockDocument {
  const parentId = parentIdOf(doc.blocks, id);
  if (parentId === undefined) return doc;
  const siblings = siblingsOf(doc, parentId);
  const fromIndex = siblings.findIndex((block) => block.id === id);
  if (fromIndex < 0) return doc;
  return moveBlock(doc, id, fromIndex + delta);
}

export function removeBlock(doc: BlockDocument, id: string): BlockDocument {
  const parentId = parentIdOf(doc.blocks, id);
  if (parentId === undefined) return doc;
  return replaceSiblings(doc, parentId, (children) => children.filter((block) => block.id !== id));
}

export function replaceBlock(doc: BlockDocument, next: ModelBlock): BlockDocument {
  const parentId = parentIdOf(doc.blocks, next.id);
  if (parentId === undefined) return doc;
  return replaceSiblings(doc, parentId, (children) =>
    children.map((block) => (block.id === next.id ? next : block)),
  );
}

/**
 * Un blocco nuovo, con le proprietà predefinite del suo schema. Le proprietà
 * non si scrivono a mano qui: si chiedono allo schema di `packages/blocks`, che
 * è la sola autorità su che cosa sia un blocco valido (ADR-005 §3.1).
 */
export function createBlock(type: BlockType): ModelBlock {
  const id = generateAdminBlockId();
  switch (type) {
    case 'rich_text':
      return {
        type,
        id,
        props: richTextPropsSchema.parse({ html: '<p>Nuovo testo</p>' }),
        children: [],
      };
    case 'separator':
      return { type, id, props: separatorPropsSchema.parse({}), children: [] };
    case 'html':
      return {
        type,
        id,
        props: htmlPropsSchema.parse({ html: '<div></div>', reason: 'manual' }),
        children: [],
      };
    case 'media_text':
      return { type, id, props: mediaTextPropsSchema.parse({}), children: [] };
    case 'post_list':
      return { type, id, props: postListPropsSchema.parse({}), children: [] };
    default:
      throw new Error(`Il blocco «${type}» non si crea da zero in questa fase.`);
  }
}

export function insertBlock(
  doc: BlockDocument,
  parentId: string | null,
  type: BlockType,
): { document: BlockDocument; insertedId: string } {
  const block = createBlock(type);
  const next = replaceSiblings(doc, parentId, (children) => [...children, block]);
  return { document: next, insertedId: block.id };
}

/** Cambia la ripartizione delle colonne di una riga (ADR-006 §3.2, ultima riga). */
export function setColumnStructure(
  doc: BlockDocument,
  rowId: string,
  structure: string,
): BlockDocument {
  const row = findBlock(doc.blocks, rowId);
  if (!row || row.type !== 'row') return doc;

  const widths = structure.split(',');
  // L'invariante di `BLOCK-MODEL.md` §3.2: `columnStructure` è esattamente
  // l'unione ordinata dei `width` delle colonne figlie. Cambiarne uno solo
  // produrrebbe un documento che lo schema rifiuta al salvataggio.
  if (widths.length !== row.children.length) return doc;

  const next: ModelBlock = {
    ...row,
    props: { ...row.props, columnStructure: structure },
    children: row.children.map((child, index) =>
      child.type === 'column'
        ? ({
            ...child,
            props: { ...child.props, width: widths[index] ?? child.props.width },
          } as ModelBlock)
        : child,
    ),
  };
  return replaceBlock(doc, next);
}

const TYPE_SUMMARY: Readonly<Record<BlockType, string>> = {
  section: 'sezione',
  row: 'riga',
  column: 'colonna',
  rich_text: 'testo',
  image: 'immagine',
  media_text: 'media e testo',
  video: 'video',
  map: 'mappa',
  separator: 'separatore',
  form: 'modulo',
  post_list: 'elenco di contenuti',
  document: 'documento',
  slider: 'presentazione',
  html: 'blocco non convertito',
};

function shorten(value: string, max = 60): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/** Il riepilogo che compare nell'albero. Mai il contenuto intero. */
export function labelOf(block: ModelBlock): string {
  switch (block.type) {
    case 'rich_text':
      return shorten(extractContentText(block.props.html)) || TYPE_SUMMARY.rich_text;
    case 'html':
      return block.props.detail ?? TYPE_SUMMARY.html;
    case 'image':
      return shorten(block.props.alt) || shorten(block.props.caption ?? '') || TYPE_SUMMARY.image;
    case 'video':
      return shorten(block.props.src);
    case 'map':
      return shorten(block.props.address);
    case 'row':
      return block.props.columnStructure;
    case 'column':
      return block.props.width;
    default:
      return TYPE_SUMMARY[block.type];
  }
}

/** Traduce il documento nell'albero che `BlockTreeEditor` sa disegnare. */
export function toTreeNodes(blocks: readonly ModelBlock[]): TreeNode[] {
  return blocks.map((block) => {
    const label = labelOf(block);
    return ALLOWED_CHILDREN[block.type].length > 0
      ? { id: block.id, type: block.type, label, children: toTreeNodes(block.children) }
      : { id: block.id, type: block.type, label };
  });
}

export type DropOutcome =
  | { readonly ok: true; readonly document: BlockDocument }
  | { readonly ok: false; readonly reason: string };

/** Il motivo per cui il rilascio non è ammesso, o `null` (DR-085, DR-097, `BLOCK-MODEL.md` §3.15). */
export function canDropBlock(
  doc: BlockDocument,
  activeId: string,
  targetId: string,
  zone: DropZone,
): string | null {
  const active = findBlock(doc.blocks, activeId);
  const target = findBlock(doc.blocks, targetId);
  if (!active || !target) return 'Il blocco non fa parte di questo documento.';
  if (findBlock([active], targetId)) return 'Un blocco non può entrare in sé stesso.';
  const parentId = zone === 'inside' ? targetId : parentIdOf(doc.blocks, targetId);
  if (parentId === undefined) return 'La destinazione non esiste più.';
  if (!allowedChildTypes(doc, parentId).includes(active.type)) {
    return 'Questo tipo di blocco non può stare lì.';
  }
  if (active.type === 'column' && parentId !== parentIdOf(doc.blocks, activeId)) {
    return 'Una colonna si sposta solo dentro la sua riga: per cambiare le colonne di una riga si usa la sua ripartizione.';
  }
  return null;
}

/**
 * Trascinamento a due esiti (DR-085): porta il blocco dentro quello di arrivo,
 * in coda ai suoi figli, oppure accanto, prima o dopo, anche in un altro
 * contenitore purché il tipo vi sia ammesso (DR-097).
 */
export function moveBlockTo(
  doc: BlockDocument,
  activeId: string,
  targetId: string,
  zone: DropZone,
): DropOutcome {
  if (activeId === targetId) return { ok: true, document: doc };
  const reason = canDropBlock(doc, activeId, targetId, zone);
  if (reason) return { ok: false, reason: `${reason} Il blocco è rimasto dov’era.` };

  const active = findBlock(doc.blocks, activeId);
  if (!active) return { ok: false, reason: 'Il blocco non fa parte di questo documento.' };
  const without = removeBlock(doc, activeId);
  if (zone === 'inside') {
    return {
      ok: true,
      document: syncColumnStructure(
        replaceSiblings(without, targetId, (children) => [...children, active]),
        targetId,
      ),
    };
  }
  const parentId = parentIdOf(without.blocks, targetId);
  if (parentId === undefined) return { ok: false, reason: 'La destinazione non esiste più.' };
  const index = siblingsOf(without, parentId).findIndex((block) => block.id === targetId);
  return {
    ok: true,
    document: syncColumnStructure(
      replaceSiblings(without, parentId, (children) => {
        const next = [...children];
        next.splice(zone === 'before' ? index : index + 1, 0, active);
        return next;
      }),
      parentId,
    ),
  };
}
