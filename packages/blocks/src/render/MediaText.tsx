import type { MediaTextBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { BlockRenderer } from './BlockRenderer';
import { imageAttributes, type MediaMap } from './media';

export interface MediaTextComponentProps {
  readonly block: MediaTextBlock;
  readonly media?: MediaMap | undefined;
}

/**
 * Resa minima: il posizionamento reale dell'immagine (percorso, varianti) è
 * lavoro della Fase 1E, che estrae i design token dal reso (`BLOCK-MODEL.md`
 * §7.3). Qui si rispetta solo la struttura e i dati già noti.
 */
export function MediaText({ block, media }: MediaTextComponentProps) {
  const { mediaId, mediaAlt } = block.props;
  return (
    <div className={blockClassName('media-text', block.props.classes)} id={block.id}>
      {mediaId !== null ? (
        media?.[mediaId] ? (
          <img alt={mediaAlt} {...imageAttributes(media[mediaId])} />
        ) : (
          <img alt={mediaAlt} data-media-id={mediaId} />
        )
      ) : null}
      {block.children.map((child) => (
        <BlockRenderer key={child.id} block={child} media={media} />
      ))}
    </div>
  );
}
