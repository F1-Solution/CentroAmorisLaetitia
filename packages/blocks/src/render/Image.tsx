import type { ImageBlock } from '../schema/block.js';
import { blockClassName } from './class-name.js';

export interface ImageComponentProps {
  readonly block: ImageBlock;
}

export function Image({ block }: ImageComponentProps) {
  const { mediaId, src, alt, caption, linkUrl, linkNewWindow } = block.props;
  const img = <img alt={alt} data-media-id={mediaId ?? undefined} data-src={mediaId === null ? (src ?? undefined) : undefined} />;
  return (
    <figure className={blockClassName('image', block.props.classes)} id={block.id}>
      {linkUrl !== null ? (
        <a href={linkUrl} target={linkNewWindow ? '_blank' : undefined} rel={linkNewWindow ? 'noopener' : undefined}>
          {img}
        </a>
      ) : (
        img
      )}
      {caption !== null ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
