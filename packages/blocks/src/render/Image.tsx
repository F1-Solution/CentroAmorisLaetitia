import type { ImageBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { imageAttributes, type MediaMap } from './media';

export interface ImageComponentProps {
  readonly block: ImageBlock;
  readonly media?: MediaMap | undefined;
}

export function Image({ block, media }: ImageComponentProps) {
  const { mediaId, src, alt, caption, linkUrl, linkNewWindow } = block.props;
  const resolved = mediaId !== null ? media?.[mediaId] : undefined;
  const img = resolved ? (
    <img alt={alt || resolved.altText || ''} {...imageAttributes(resolved)} />
  ) : media && mediaId === null && src ? (
    <img alt={alt} src={src} />
  ) : (
    <img
      alt={alt}
      data-media-id={mediaId ?? undefined}
      data-src={mediaId === null ? (src ?? undefined) : undefined}
    />
  );
  return (
    <figure className={blockClassName('image', block.props.classes)} id={block.id}>
      {linkUrl !== null ? (
        <a
          href={linkUrl}
          target={linkNewWindow ? '_blank' : undefined}
          rel={linkNewWindow ? 'noopener' : undefined}
        >
          {img}
        </a>
      ) : (
        img
      )}
      {caption !== null ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
