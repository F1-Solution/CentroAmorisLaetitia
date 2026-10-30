/** Titolo di una slide: se ne ammette solo un sottoinsieme di HTML, a capo, allineamento di `div` e `p` e il cuore resi con classi (DR-307, DR-311). */
import { parseFragment } from 'parse5';
import type { DefaultTreeAdapterTypes as Tree } from 'parse5';
import { DANGEROUS_ELEMENTS } from './allowlist';
import { isCommentNode, isElementNode, isTextNode } from './tree';
import { escapeText } from '../serialize/escape';

/** Allineamento di un titolo, come lo conserva l'editor dei caroselli. */
export type SlideTitleAlignment = 'left' | 'center' | 'right';

const ALIGNMENTS = new Set(['left', 'center', 'right']);
const BLOCK_ELEMENTS = new Set(['div', 'p']);

/** Icona ammessa nel titolo: il sito carica solo il cuore di Font Awesome (DR-311). */
export type SlideTitleIcon = 'heart';

/** Classi d'icona della sorgente ammesse, con l'icona che rappresentano. */
const SOURCE_ICON_CLASSES: ReadonlyMap<string, SlideTitleIcon> = new Map([
  ['fa-heart', 'heart'],
  ['fa fa-heart', 'heart'],
]);

/** La classe del sito per ogni icona: il risultato del filtro la rilegge (punto fisso). */
const SITE_ICON_CLASSES: Readonly<Record<SlideTitleIcon, string>> = {
  heart: 'blk-slide-icon-heart',
};

function alignmentOf(node: Tree.Element): string | null {
  const attr = (name: string) => node.attrs.find((a) => a.name.toLowerCase() === name)?.value;
  const align = attr('align')?.trim().toLowerCase();
  if (align && ALIGNMENTS.has(align)) return align;
  // Vale l'ultima dichiarazione `text-align` dello stile; le altre si ignorano.
  const values = (attr('style') ?? '')
    .split(';')
    .map((declaration) => declaration.split(':'))
    .filter(([name]) => name?.trim().toLowerCase() === 'text-align')
    .map(([, value]) => value?.trim().toLowerCase() ?? '');
  const last = values[values.length - 1];
  return last && ALIGNMENTS.has(last) ? last : null;
}

function ownAlignmentOf(node: Tree.Element): string | null {
  const classes = (node.attrs.find((a) => a.name.toLowerCase() === 'class')?.value ?? '').split(
    /\s+/,
  );
  if (!classes.includes('blk-slide-block')) return null;
  const found = classes.find((c) => /^blk-slide-align-(left|center|right)$/.test(c));
  return found ? found.slice('blk-slide-align-'.length) : '';
}

/** L'icona di un `i` vuoto con la sola classe ammessa, o la nostra forma già ripulita. */
function iconOf(node: Tree.Element): SlideTitleIcon | null {
  if (node.tagName !== 'i' || node.childNodes.length > 0) return null;
  const attrs = new Map(node.attrs.map((a) => [a.name.toLowerCase(), a.value]));
  const classes = (attrs.get('class') ?? '').split(/\s+/).filter(Boolean).join(' ');
  if (attrs.size === 1) return SOURCE_ICON_CLASSES.get(classes) ?? null;
  if (attrs.size !== 2 || attrs.get('aria-hidden') !== 'true') return null;
  const ours = Object.entries(SITE_ICON_CLASSES).find(([, name]) => name === classes);
  return ours ? (ours[0] as SlideTitleIcon) : null;
}

function render(nodes: readonly Tree.ChildNode[]): string {
  return nodes.map(renderNode).join('');
}

function renderNode(node: Tree.ChildNode): string {
  if (isTextNode(node)) return escapeText(node.value);
  if (isCommentNode(node) || !isElementNode(node)) return '';
  const tag = node.tagName;
  if (DANGEROUS_ELEMENTS.has(tag)) return '';
  if (tag === 'br') return '<br>';
  const children = render(node.childNodes);
  // Il risultato stesso è un punto fisso: una nostra `span` di allineamento si riconosce.
  const ours = tag === 'span' ? ownAlignmentOf(node) : null;
  if (BLOCK_ELEMENTS.has(tag) || (tag === 'span' && ours !== null)) {
    const align = ours || alignmentOf(node);
    const cls = align
      ? ` class="blk-slide-block blk-slide-align-${align}"`
      : ' class="blk-slide-block"';
    return `<span${cls}>${children}</span>`;
  }
  const icon = iconOf(node);
  if (icon) return `<i class="${SITE_ICON_CLASSES[icon]}" aria-hidden="true"></i>`;
  return children;
}

/** Il titolo con il solo HTML ammesso, pronto per la resa. */
export function sanitizeSlideTitle(html: string): string {
  return render(parseFragment(html).childNodes);
}

/** Un blocco del titolo: `div` o `p` importati, o una nostra `span` di allineamento. */
function isBlock(node: Tree.Element): boolean {
  return (
    BLOCK_ELEMENTS.has(node.tagName) || (node.tagName === 'span' && ownAlignmentOf(node) !== null)
  );
}

/** Il testo del titolo, con `separator` al posto di ogni a capo e ai bordi di ogni blocco. */
function plain(nodes: readonly Tree.ChildNode[], separator: string): string {
  return nodes
    .map((node) => {
      if (isTextNode(node)) return node.value.replace(/\s+/g, ' ');
      if (isCommentNode(node) || !isElementNode(node)) return '';
      if (DANGEROUS_ELEMENTS.has(node.tagName)) return '';
      if (node.tagName === 'br') return separator;
      const inner = plain(node.childNodes, separator);
      return isBlock(node) ? `${separator}${inner}${separator}` : inner;
    })
    .join('');
}

/** Il titolo senza tag, su una riga, per la descrizione dell'immagine. */
export function slideTitleText(html: string): string {
  return plain(parseFragment(html).childNodes, ' ').replace(/\s+/g, ' ').trim();
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Il titolo senza tag per l'editor dei caroselli: ogni a capo e ogni blocco su una riga. */
export function slideTitleEditText(html: string): string {
  return lines(plain(parseFragment(html).childNodes, '\n')).join('\n');
}

function firstAlignment(nodes: readonly Tree.ChildNode[]): SlideTitleAlignment | null | undefined {
  for (const node of nodes) {
    if (!isElementNode(node) || DANGEROUS_ELEMENTS.has(node.tagName)) continue;
    if (isBlock(node)) {
      const align = (node.tagName === 'span' ? ownAlignmentOf(node) : null) || alignmentOf(node);
      return align ? (align as SlideTitleAlignment) : null;
    }
    const inner = firstAlignment(node.childNodes);
    if (inner !== undefined) return inner;
  }
  return undefined;
}

/** L'allineamento del primo blocco del titolo, o `null` se non ne ha. */
export function slideTitleAlignment(html: string): SlideTitleAlignment | null {
  return firstAlignment(parseFragment(html).childNodes) ?? null;
}

function collectIcons(nodes: readonly Tree.ChildNode[]): SlideTitleIcon[] {
  return nodes.flatMap((node) => {
    if (!isElementNode(node) || DANGEROUS_ELEMENTS.has(node.tagName)) return [];
    const icon = iconOf(node);
    return icon ? [icon] : collectIcons(node.childNodes);
  });
}

/** Le icone ammesse del titolo, nell'ordine in cui compaiono. */
export function slideTitleIcons(html: string): SlideTitleIcon[] {
  return collectIcons(parseFragment(html).childNodes);
}

/** Vero se il titolo contiene tag o commenti, non solo testo ed entità. */
export function slideTitleHasMarkup(html: string): boolean {
  return parseFragment(html).childNodes.some((node) => !isTextNode(node));
}

/** Il titolo scritto nell'editor: testo protetto, a capo come `br`, icone in coda e, se c'è, l'allineamento. */
export function slideTitleFromText(
  text: string,
  align: SlideTitleAlignment | null,
  icons: readonly SlideTitleIcon[] = [],
): string {
  const written = lines(text).map(escapeText).join('<br>');
  if (written === '') return '';
  const marks = icons.map((icon) => `<i class="fa-${icon}"></i>`).join('');
  const body = marks ? `${written} ${marks}` : written;
  if (!align || !ALIGNMENTS.has(align)) return body;
  return `<div align="${align}">${body}</div>`;
}
