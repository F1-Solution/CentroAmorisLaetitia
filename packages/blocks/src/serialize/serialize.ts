/**
 * Serializzazione deterministica blocchi → HTML (`BLOCK-MODEL.md` §6, ADR-005
 * §3.6). Alimenta `contents.content_html`, che è una **cache**: porta il testo
 * e l'identità dei blocchi, non le loro proprietà di presentazione (§6.1).
 *
 * Puro, totale, deterministico (regola 12): nessuna data, nessuna lingua,
 * nessun valore casuale, nessuna lettura di configurazione.
 */
import type { BlockNode } from '../schema/block';
import type { BlockDocument } from '../schema/document';
import { escapeAttributeValue, escapeText, VOID_ELEMENTS } from './escape';

/** Involucro di ogni blocco: un solo elemento, con `class` e `id` (§6.2, §6.3). */
function wrapBlock(
  tag: string,
  kind: string,
  id: string,
  classes: readonly string[],
  extraAttrs: Readonly<Record<string, string | null>>,
  inner: string,
): string {
  const classValue = ['blk', `blk-${kind}`, ...classes].join(' ');
  const extraKeys = Object.keys(extraAttrs).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const attrEntries: [string, string | null][] = [
    ['class', classValue],
    ['id', id],
    ...extraKeys.map((key): [string, string | null] => [key, extraAttrs[key] ?? null]),
  ];
  const attrsHtml = attrEntries
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([name, value]) => ` ${name}="${escapeAttributeValue(value)}"`)
    .join('');

  if (VOID_ELEMENTS.has(tag)) {
    return `<${tag}${attrsHtml}>`;
  }
  return `<${tag}${attrsHtml}>${inner}</${tag}>`;
}

/** Serializza un elenco di blocchi fratelli, senza separatori (regola 2). */
export function serializeBlocks(nodes: readonly BlockNode[]): string {
  return nodes.map(serializeBlock).join('');
}

export function serializeBlockDocument(doc: BlockDocument): string {
  return serializeBlocks(doc.blocks);
}

export function serializeBlock(node: BlockNode): string {
  // Niente destrutturazione di `node.props` prima dello switch: perderebbe il
  // legame fra `node.type` e la forma di `props` che l'unione discriminata dà.
  switch (node.type) {
    case 'section':
      return wrapBlock('section', 'section', node.id, node.props.classes, {}, serializeBlocks(node.children));
    case 'row':
      return wrapBlock('div', 'row', node.id, node.props.classes, {}, serializeBlocks(node.children));
    case 'column':
      return wrapBlock('div', 'column', node.id, node.props.classes, {}, serializeBlocks(node.children));
    case 'media_text': {
      // Il §6.2 parla di "mediaId o src", ma lo schema di `media_text` (§3.6)
      // ha solo `mediaId`: non esiste un campo `src` distinto su questo tipo.
      const img = node.props.mediaId !== null ? '<img>' : '';
      return wrapBlock('div', 'media-text', node.id, node.props.classes, {}, img + serializeBlocks(node.children));
    }
    case 'rich_text':
      // Non sanifica: `props.html` è già un punto fisso, copiato così com'è (regola 11).
      return wrapBlock('div', 'text', node.id, node.props.classes, {}, node.props.html);
    case 'image': {
      const img = `<img alt="${escapeAttributeValue(node.props.alt)}">`;
      const caption = node.props.caption !== null ? `<figcaption>${escapeText(node.props.caption)}</figcaption>` : '';
      return wrapBlock('figure', 'image', node.id, node.props.classes, {}, img + caption);
    }
    case 'video':
      return wrapBlock('div', 'video', node.id, node.props.classes, {}, '');
    case 'map': {
      const parts = [escapeText(node.props.address)];
      for (const pin of node.props.pins) {
        if (pin.title !== null) {
          parts.push(escapeText(pin.title));
        }
      }
      return wrapBlock('div', 'map', node.id, node.props.classes, {}, parts.join(' '));
    }
    case 'separator':
      return wrapBlock('hr', 'separator', node.id, node.props.classes, {}, '');
    case 'form':
      return wrapBlock('div', 'form', node.id, node.props.classes, {}, '');
    case 'post_list':
      return wrapBlock('div', 'post-list', node.id, node.props.classes, {}, '');
    case 'document':
      return wrapBlock(
        'div',
        'document',
        node.id,
        node.props.classes,
        {},
        node.props.label !== null ? escapeText(node.props.label) : '',
      );
    case 'slider':
      return wrapBlock('div', 'slider', node.id, node.props.classes, {}, '');
    case 'html':
      // Come `rich_text`: il contenuto del blocco di riserva si copia così com'è.
      return wrapBlock('div', 'raw', node.id, node.props.classes, {}, node.props.html);
  }
}
