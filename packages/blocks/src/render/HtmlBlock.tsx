import type { HtmlBlock as HtmlBlockNode } from '../schema/block';
import { blockClassName } from './class-name';

export interface HtmlBlockComponentProps {
  readonly block: HtmlBlockNode;
}

/**
 * Il blocco di riserva. Il frammento originale non passa dal §5: si rende
 * così com'è, come farebbe il sito con l'HTML sorgente (ADR-005 opzione C).
 * L'avviso «questo blocco non è stato convertito» è dell'editor
 * (ADR-006 §3.4), non di questo componente condiviso.
 *
 * Nome `ReserveHtmlBlock` per non collidere con il tipo `HtmlBlock`
 * dello schema (il nodo `type: 'html'`).
 */
export function ReserveHtmlBlock({ block }: HtmlBlockComponentProps) {
  return (
    <div
      className={blockClassName('raw', block.props.classes)}
      id={block.id}
      data-reason={block.props.reason}
      dangerouslySetInnerHTML={{ __html: block.props.html }}
    />
  );
}
