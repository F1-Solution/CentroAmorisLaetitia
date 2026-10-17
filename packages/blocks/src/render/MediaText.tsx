import type { MediaTextBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { BlockRenderer } from './BlockRenderer';
import { imageAttributes, type MediaMap } from './media';

export interface MediaTextComponentProps {
  readonly block: MediaTextBlock;
  readonly media?: MediaMap | undefined;
}

/**
 * Immagine e contenuto affiancati come `wp-block-media-text`: la griglia sta nel
 * foglio di stile del sito, qui solo struttura e attributi (V, DR-157).
 */
export function MediaText({ block, media }: MediaTextComponentProps) {
  const { mediaId, mediaAlt, mediaPosition, verticalAlignment } = block.props;
  return (
    <div
      className={blockClassName('media-text', block.props.classes)}
      id={block.id}
      data-media-position={mediaPosition}
      data-align={verticalAlignment}
    >
      <figure className="blk-media-text-media">
        {mediaId !== null ? (
          media?.[mediaId] ? (
            <img alt={mediaAlt} {...imageAttributes(media[mediaId])} />
          ) : (
            <img alt={mediaAlt} data-media-id={mediaId} />
          )
        ) : null}
      </figure>
      <div className="blk-media-text-content">
        {block.children.map((child) => (
          <BlockRenderer key={child.id} block={child} media={media} />
        ))}
      </div>
    </div>
  );
}
