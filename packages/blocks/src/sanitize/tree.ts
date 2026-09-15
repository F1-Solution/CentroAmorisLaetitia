/**
 * Aiuti minimi per distinguere i nodi dell'albero di `parse5` (adattatore
 * predefinito), senza importare l'intero spazio dei nomi dei tipi.
 */
import type { DefaultTreeAdapterTypes as Tree } from 'parse5';

export function isElementNode(node: Tree.ChildNode): node is Tree.Element {
  return 'tagName' in node;
}

export function isTextNode(node: Tree.ChildNode): node is Tree.TextNode {
  return node.nodeName === '#text';
}

export function isCommentNode(node: Tree.ChildNode): node is Tree.CommentNode {
  return node.nodeName === '#comment';
}
