import type { BlockNode } from '../schema/block.js';
import { Section } from './Section.js';
import { Row } from './Row.js';
import { Column } from './Column.js';
import { RichText } from './RichText.js';
import { Image } from './Image.js';
import { MediaText } from './MediaText.js';
import { Video } from './Video.js';
import { Map } from './Map.js';
import { Separator } from './Separator.js';
import { Form } from './Form.js';
import { PostList } from './PostList.js';
import { DocBlock } from './DocBlock.js';
import { Slider } from './Slider.js';
import { ReserveHtmlBlock } from './HtmlBlock.js';

export interface BlockRendererProps {
  readonly block: BlockNode;
}

/**
 * Dispatcher unico: un tipo, un componente. È lo stesso componente usato dal
 * sito pubblico e dall'anteprima dell'area amministrativa (ADR-006 §3.3).
 */
export function BlockRenderer({ block }: BlockRendererProps) {
  switch (block.type) {
    case 'section':
      return <Section block={block} />;
    case 'row':
      return <Row block={block} />;
    case 'column':
      return <Column block={block} />;
    case 'rich_text':
      return <RichText block={block} />;
    case 'image':
      return <Image block={block} />;
    case 'media_text':
      return <MediaText block={block} />;
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
