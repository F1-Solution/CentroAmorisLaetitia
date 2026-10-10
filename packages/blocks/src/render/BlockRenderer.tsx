import type { BlockNode } from '../schema/block';
import type { MediaMap } from './media';
import { Section } from './Section';
import { Row } from './Row';
import { Column } from './Column';
import { RichText } from './RichText';
import { Image } from './Image';
import { MediaText } from './MediaText';
import { Video } from './Video';
import { Map } from './Map';
import { Separator } from './Separator';
import { Form } from './Form';
import { PostList } from './PostList';
import { DocBlock } from './DocBlock';
import { Slider } from './Slider';
import { ReserveHtmlBlock } from './HtmlBlock';

export interface BlockRendererProps {
  readonly block: BlockNode;
  /** I media noti a chi rende; senza, le immagini restano segnaposto. */
  readonly media?: MediaMap | undefined;
}

/**
 * Dispatcher unico: un tipo, un componente. È lo stesso componente usato dal
 * sito pubblico e dall'anteprima dell'area amministrativa (ADR-006 §3.3).
 */
export function BlockRenderer({ block, media }: BlockRendererProps) {
  switch (block.type) {
    case 'section':
      return <Section block={block} media={media} />;
    case 'row':
      return <Row block={block} media={media} />;
    case 'column':
      return <Column block={block} media={media} />;
    case 'rich_text':
      return <RichText block={block} />;
    case 'image':
      return <Image block={block} media={media} />;
    case 'media_text':
      return <MediaText block={block} media={media} />;
    case 'video':
      return <Video block={block} />;
    case 'map':
      return <Map block={block} />;
    case 'separator':
      return <Separator block={block} />;
    case 'form':
      return <Form block={block} />;
    case 'post_list':
      return <PostList block={block} />;
    case 'document':
      return <DocBlock block={block} />;
    case 'slider':
      return <Slider block={block} />;
    case 'html':
      return <ReserveHtmlBlock block={block} />;
  }
}
