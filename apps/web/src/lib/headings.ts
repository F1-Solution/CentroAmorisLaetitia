import type { BlockDocument } from '@amoris/blocks';

/**
 * Il titolo principale delle 29 pagine che nella sorgente non hanno un `<h1>`
 * (DR-040, criterio 1E-14): «reso graficamente identico al testo che oggi lo
 * sostituisce». Il primo titolo del contenuto diventa `<h1>` e conserva l'aspetto
 * del suo livello con la classe `come-hN`; se il contenuto non ha titoli, il
 * titolo della pagina resta un `<h1>` non visibile, che non cambia la resa.
 *
 * Tocca solo l'HTML reso: il documento salvato non cambia.
 */

const FIRST_HEADING = /<h([2-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/i;

function hasH1(document: BlockDocument): boolean {
  return /<h1[\s>]/i.test(JSON.stringify(document.blocks));
}

/** `class="…"` con in più `come-hN`, o un attributo nuovo. */
function withClass(attributes: string, level: string): string {
  const extra = `come-h${level}`;
  if (/\sclass="/i.test(attributes)) {
    return attributes.replace(
      /\sclass="([^"]*)"/i,
      (_whole, classes: string) => ` class="${classes} ${extra}"`,
    );
  }
  return `${attributes} class="${extra}"`;
}

export interface PromotedHeading {
  readonly document: BlockDocument;
  /** `true` se un titolo del contenuto è diventato `<h1>`. */
  readonly promoted: boolean;
  /** `true` se il documento reso contiene un `<h1>`, suo o promosso: il titolo nascosto non serve. */
  readonly hasH1: boolean;
}

export function promoteFirstHeading(document: BlockDocument): PromotedHeading {
  if (hasH1(document)) return { document, promoted: false, hasH1: true };
  let promoted = false;
  const visit = (node: unknown): unknown => {
    if (promoted || node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(visit);
    const block = node as { type?: string; props?: Record<string, unknown>; children?: unknown[] };
    if (block.type === 'rich_text' && typeof block.props?.html === 'string') {
      const html = block.props.html;
      const match = FIRST_HEADING.exec(html);
      if (match) {
        promoted = true;
        const [whole, level = '2', attributes = '', inner = ''] = match;
        return {
          ...block,
          props: {
            ...block.props,
            html: html.replace(whole, `<h1${withClass(attributes, level)}>${inner}</h1>`),
          },
        };
      }
    }
    return block.children ? { ...block, children: block.children.map(visit) } : block;
  };
  const blocks = visit(document.blocks) as BlockDocument['blocks'];
  return { document: promoted ? { ...document, blocks } : document, promoted, hasH1: promoted };
}
