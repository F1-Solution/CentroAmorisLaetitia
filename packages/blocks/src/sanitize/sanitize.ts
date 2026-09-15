/**
 * Sanificazione di `rich_text`, a elenco chiuso (`BLOCK-MODEL.md` §5, ADR-005
 * §3.5). Usa `parse5` per l'analisi conforme alla specifica — necessaria a
 * ricollocare un elemento ammesso in posizione non valida come farebbe un
 * browser (§5.4, ultima riga) — ma il serializzatore è nostro: l'ordine degli
 * attributi e la forma dei tag vuoti sono decisioni di questo documento, non
 * delegabili (`PLAN.md` §5).
 */
import { parseFragment } from 'parse5';
import type { DefaultTreeAdapterTypes as Tree } from 'parse5';
import {
  ALLOWED_ELEMENTS,
  DANGEROUS_ELEMENTS,
  RESIDUAL_ATTRIBUTES,
  allowedAttributesFor,
  isEventHandlerAttribute,
} from './allowlist.js';
import { ALLOWED_TARGET_VALUES, isAllowedUrl } from './url.js';
import { escapeAttributeValue, escapeText, VOID_ELEMENTS } from '../serialize/escape.js';
import { isCommentNode, isElementNode, isTextNode } from './tree.js';

export type SanitizeIssueSeverity = 'info' | 'warning' | 'error';

export interface SanitizeIssue {
  readonly severity: SanitizeIssueSeverity;
  readonly element: string;
  readonly attribute?: string;
  /** Solo per `style`: il valore rimosso si registra a parte (§5.4). */
  readonly value?: string;
  readonly message: string;
}

export type SanitizeOutcome =
  | { readonly ok: true; readonly html: string; readonly issues: SanitizeIssue[] }
  | {
      readonly ok: false;
      /** §5.4, quarta riga: un elemento non ammesso e innocuo fa fallire l'intero blocco. */
      readonly reason: 'unmapped_markup';
      readonly element: string;
      readonly issues: SanitizeIssue[];
    };

interface FallbackFlag {
  hit: boolean;
  element: string;
}

/**
 * Sanifica un frammento HTML secondo l'elenco chiuso. Se contiene un elemento
 * non ammesso ma innocuo, non sanifica nulla: restituisce `ok: false`, e sta al
 * chiamante (il convertitore, `1D-W3`) trasformare l'intero blocco in un
 * blocco di riserva `html` con `reason: 'divi_unmapped_markup'`.
 */
export function sanitizeRichText(html: string): SanitizeOutcome {
  const fragment = parseFragment(html);
  const issues: SanitizeIssue[] = [];
  const fallback: FallbackFlag = { hit: false, element: '' };
  const out = processChildren(fragment.childNodes, issues, fallback);
  if (fallback.hit) {
    return { ok: false, reason: 'unmapped_markup', element: fallback.element, issues };
  }
  return { ok: true, html: out, issues };
}

function processChildren(nodes: Tree.ChildNode[], issues: SanitizeIssue[], fallback: FallbackFlag): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (fallback.hit) {
      return '';
    }
    const rendered = processNode(node, issues, fallback);
    if (rendered !== null) {
      parts.push(rendered);
    }
  }
  return parts.join('');
}

function processNode(node: Tree.ChildNode, issues: SanitizeIssue[], fallback: FallbackFlag): string | null {
  if (isTextNode(node)) {
    return escapeText(node.value);
  }
  if (isCommentNode(node)) {
    // Un commento non è né un elemento né un attributo dell'elenco chiuso: si
    // rimuove senza produrre una riga, perché non porta contenuto visibile.
    return null;
  }
  if (!isElementNode(node)) {
    return null;
  }

  const tag = node.tagName;

  if (DANGEROUS_ELEMENTS.has(tag)) {
    issues.push({
      severity: 'error',
      element: tag,
      message: 'elemento pericoloso rimosso con tutto il contenuto (§5.4)',
    });
    return null;
  }

  if (!ALLOWED_ELEMENTS.has(tag)) {
    fallback.hit = true;
    fallback.element = tag;
    return null;
  }

  const allowed = allowedAttributesFor(tag);
  const keptAttrs: { name: string; value: string }[] = [];

  for (const attr of node.attrs) {
    const name = attr.name.toLowerCase();

    if (isEventHandlerAttribute(name)) {
      // Un gestore di evento è un attributo, non un elemento: si rimuove
      // l'attributo con severità `error`, ma il contenuto resta (§5.4).
      issues.push({
        severity: 'error',
        element: tag,
        attribute: name,
        message: 'gestore di evento rimosso (§5.4)',
      });
      continue;
    }
    if (RESIDUAL_ATTRIBUTES.has(name)) {
      issues.push({
        severity: 'info',
        element: tag,
        attribute: name,
        message: "residuo di un incollaggio senza effetto, rimosso (ADR-005 §1.3)",
      });
      continue;
    }
    if (!allowed.includes(name)) {
      if (name === 'style') {
        issues.push({
          severity: 'info',
          element: tag,
          attribute: 'style',
          value: attr.value,
          message: 'style in linea rimosso; il valore si registra a parte (§5.4)',
        });
      } else {
        issues.push({
          severity: 'info',
          element: tag,
          attribute: name,
          message: 'attributo non ammesso su questo elemento, rimosso',
        });
      }
      continue;
    }
    if ((name === 'href' || name === 'src') && !isAllowedUrl(attr.value)) {
      issues.push({
        severity: 'error',
        element: tag,
        attribute: name,
        value: attr.value,
        message: "valore non ammesso nell'URL, attributo rimosso (§5.3)",
      });
      continue;
    }
    if (name === 'target' && !ALLOWED_TARGET_VALUES.has(attr.value)) {
      issues.push({
        severity: 'info',
        element: tag,
        attribute: 'target',
        value: attr.value,
        message: 'valore di target non ammesso, rimosso',
      });
      continue;
    }
    if ((name === 'width' || name === 'height') && tag === 'img' && !/^\d+$/.test(attr.value)) {
      issues.push({
        severity: 'info',
        element: tag,
        attribute: name,
        value: attr.value,
        message: 'width/height su img accettano solo cifre, rimosso',
      });
      continue;
    }
    keptAttrs.push({ name, value: attr.value });
  }

  // Ordine totale e deterministico: alfabetico. Garantisce l'idempotenza,
  // indipendentemente dall'ordine con cui la sorgente scriveva gli attributi.
  keptAttrs.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const childrenHtml = processChildren(node.childNodes ?? [], issues, fallback);
  if (fallback.hit) {
    return null;
  }

  const attrsHtml = keptAttrs.map((a) => ` ${a.name}="${escapeAttributeValue(a.value)}"`).join('');

  if (VOID_ELEMENTS.has(tag)) {
    return `<${tag}${attrsHtml}>`;
  }
  return `<${tag}${attrsHtml}>${childrenHtml}</${tag}>`;
}

/** Vero se `html` è un punto fisso della sanificazione (`BLOCK-MODEL.md` §3.4, §5.6). */
export function isSanitizedFixedPoint(html: string): boolean {
  const outcome = sanitizeRichText(html);
  return outcome.ok && outcome.html === html;
}
