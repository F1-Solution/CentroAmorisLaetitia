/**
 * Che cosa si rimuove anche dentro il blocco di riserva `html`
 * (`BLOCK-MODEL.md` §3.14.2). Il blocco conserva la fedeltà, non il pericolo:
 * a differenza di `sanitizeRichText`, qui **non** si applica l'elenco chiuso
 * degli elementi — un `<font>` o un `<center>` restano — ma gli elementi
 * pericolosi e i gestori di evento si rimuovono comunque, sempre con gravità
 * `error`.
 */
import { parseFragment } from 'parse5';
import type { DefaultTreeAdapterTypes as Tree } from 'parse5';
import { DANGEROUS_ELEMENTS, isEventHandlerAttribute } from './allowlist.js';
import { escapeAttributeValue, escapeText, VOID_ELEMENTS } from '../serialize/escape.js';
import { isCommentNode, isElementNode, isTextNode } from './tree.js';
import type { SanitizeIssue } from './sanitize.js';

export interface StripDangerousResult {
  readonly html: string;
  readonly issues: SanitizeIssue[];
}

export function stripDangerousMarkup(html: string): StripDangerousResult {
  const fragment = parseFragment(html);
  const issues: SanitizeIssue[] = [];
  const out = stripChildren(fragment.childNodes, issues);
  return { html: out, issues };
}

function stripChildren(nodes: Tree.ChildNode[], issues: SanitizeIssue[]): string {
  return nodes
    .map((node) => stripNode(node, issues))
    .filter((rendered): rendered is string => rendered !== null)
    .join('');
}

function stripNode(node: Tree.ChildNode, issues: SanitizeIssue[]): string | null {
  if (isTextNode(node)) {
    return escapeText(node.value);
  }
  if (isCommentNode(node)) {
    return `<!--${node.data}-->`;
  }
  if (!isElementNode(node)) {
    return null;
  }

  const tag = node.tagName;

  if (DANGEROUS_ELEMENTS.has(tag)) {
    issues.push({
      severity: 'error',
      element: tag,
      message: 'elemento pericoloso rimosso con tutto il contenuto (§3.14.2)',
    });
    return null;
  }

  const keptAttrs: { name: string; value: string }[] = [];
  for (const attr of node.attrs) {
    const name = attr.name.toLowerCase();
    if (isEventHandlerAttribute(name)) {
      issues.push({
        severity: 'error',
        element: tag,
        attribute: name,
        message: 'gestore di evento rimosso (§3.14.2)',
      });
      continue;
    }
    keptAttrs.push({ name, value: attr.value });
  }

  const childrenHtml = stripChildren(node.childNodes ?? [], issues);
  const attrsHtml = keptAttrs.map((a) => ` ${a.name}="${escapeAttributeValue(a.value)}"`).join('');

  if (VOID_ELEMENTS.has(tag)) {
    return `<${tag}${attrsHtml}>`;
  }
  return `<${tag}${attrsHtml}>${childrenHtml}</${tag}>`;
}
