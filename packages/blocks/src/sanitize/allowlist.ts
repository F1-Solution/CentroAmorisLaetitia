/**
 * Elenco chiuso di elementi e attributi ammessi in `rich_text` (`BLOCK-MODEL.md`
 * §5.1, §5.2). Ventotto elementi; `h1` è escluso apposta (il titolo appartiene al
 * template, ADR-005 §3.5).
 */

export const ALLOWED_ELEMENTS = new Set([
  'p',
  'br',
  'hr',
  'div',
  'figure',
  'figcaption',
  'span',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]);

/**
 * Elementi pericolosi: si rimuovono sempre, con tutto il loro contenuto, anche
 * dentro il blocco di riserva `html` (§3.14.2, §5.4).
 */
export const DANGEROUS_ELEMENTS = new Set(['script', 'iframe', 'object', 'embed', 'form', 'style']);

/** Attributi ammessi su ogni elemento della lista chiusa. */
const COMMON_ATTRIBUTES = ['id', 'class', 'title'];

/** Attributi ammessi **in più**, per elemento (§5.2). */
const EXTRA_ATTRIBUTES_BY_ELEMENT: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  th: ['colspan', 'rowspan'],
  td: ['colspan', 'rowspan'],
};

export function allowedAttributesFor(tagName: string): readonly string[] {
  return [...COMMON_ATTRIBUTES, ...(EXTRA_ATTRIBUTES_BY_ELEMENT[tagName] ?? [])];
}

/** Residui di un incollaggio senza effetto (ADR-005 §1.3): si rimuovono senza conteggio speciale. */
export const RESIDUAL_ATTRIBUTES = new Set(['data-start', 'data-end']);

export function isEventHandlerAttribute(name: string): boolean {
  return name.toLowerCase().startsWith('on');
}
