import type { MediaTextBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { BlockRenderer } from './BlockRenderer';

export interface MediaTextComponentProps {
  readonly block: MediaTextBlock;
}

/**
 * Resa minima: il posizionamento reale dell'immagine (percorso, varianti) è
 * lavoro della Fase 1E, che estrae i design token dal reso (`BLOCK-MODEL.md`
 * §7.3). Qui si rispetta solo la struttura e i dati già noti.
 */
export function MediaText({ block }: MediaTextComponentProps) {
  const { mediaId, mediaAlt } = block.props;
  return (
    <div className={blockClassName('media-text', block.props.classes)} id={block.id}>
      {mediaId !== null ? <img alt={mediaAlt} data-media-id={mediaId} /> : null}
      {block.children.map((child) => (
        <BlockRenderer key={child.id} block={child} />
      ))}
    </div>
  );
}
