import { emptySpacing } from '../common';
import type { ImageBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { imageAttributes, type MediaMap } from './media';
import { spacingVariables } from './spacing';

export interface ImageComponentProps {
  readonly block: ImageBlock;
  readonly media?: MediaMap | undefined;
}

export function Image({ block, media }: ImageComponentProps) {
  const {
    mediaId,
    src,
    variant,
    alt,
    title,
    caption,
    decorative,
    useMediaCaption,
    linkUrl,
    linkNewWindow,
  } = block.props;
  const resolved = mediaId !== null ? media?.[mediaId] : undefined;
  // Testo alternativo e didascalia vuoti nel blocco si leggono dal media a ogni resa (DR-305).
  const altText = decorative ? '' : alt || resolved?.altText || '';
  const titleText = title || undefined;
  const img = resolved ? (
    <img alt={altText} title={titleText} {...imageAttributes(resolved, variant)} />
  ) : media && mediaId === null && src ? (
    <img alt={altText} title={titleText} src={src} />
  ) : (
    <img
      alt={altText}
      title={titleText}
      data-media-id={mediaId ?? undefined}
      data-src={mediaId === null ? (src ?? undefined) : undefined}
    />
  );
  // I blocchi importati non leggono la didascalia del media (DR-312).
  const figureCaption = caption ?? (useMediaCaption === false ? null : (resolved?.caption ?? null));
  return (
    <figure
      className={blockClassName('image', block.props.classes)}
      style={spacingVariables(emptySpacing, block.props.margin)}
      id={block.id}
    >
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
      {figureCaption !== null ? <figcaption>{figureCaption}</figcaption> : null}
    </figure>
  );
}
