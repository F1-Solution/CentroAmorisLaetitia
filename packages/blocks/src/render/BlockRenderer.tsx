import type { BlockNode } from '../schema/block';
import type { MediaMap } from './media';
import type { SlidersMap, FormsMap, PostListsMap } from './data-maps';
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
  /** Le slide dei caroselli citati, chiave l'identificativo del carosello. */
  readonly sliders?: SlidersMap | undefined;
  /** Le definizioni dei form citati, chiave l'identificativo del form. */
  readonly forms?: FormsMap | undefined;
  /** Gli articoli già risolti per ogni blocco `post_list`, chiave l'identificativo del blocco. */
  readonly postLists?: PostListsMap | undefined;
}

/**
 * Dispatcher unico: un tipo, un componente. È lo stesso componente usato dal
 * sito pubblico e dall'anteprima dell'area amministrativa (ADR-006 §3.3).
 */
export function BlockRenderer({ block, media, sliders, forms, postLists }: BlockRendererProps) {
  switch (block.type) {
    case 'section':
      return (
        <Section
          block={block}
          media={media}
          sliders={sliders}
          forms={forms}
          postLists={postLists}
        />
      );
    case 'row':
      return (
        <Row block={block} media={media} sliders={sliders} forms={forms} postLists={postLists} />
      );
    case 'column':
      return (
        <Column block={block} media={media} sliders={sliders} forms={forms} postLists={postLists} />
      );
    case 'rich_text':
      return <RichText block={block} />;
    case 'image':
      return <Image block={block} media={media} />;
    case 'media_text':
      return <MediaText block={block} media={media} />;
    case 'video':
      return <Video block={block} media={media} />;
    case 'map':
      return <Map block={block} />;
    case 'separator':
      return <Separator block={block} />;
    case 'form':
      return <Form block={block} form={forms?.[block.props.formId]} />;
    case 'post_list':
      return <PostList block={block} media={media} posts={postLists?.[block.id]} />;
    case 'document':
      return <DocBlock block={block} />;
    case 'slider':
      return <Slider block={block} media={media} slider={sliders?.[block.props.sliderId]} />;
    case 'html':
      return <ReserveHtmlBlock block={block} />;
  }
}
