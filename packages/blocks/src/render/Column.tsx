import type { ColumnBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { spacingVariables } from './spacing';
import { BlockRenderer } from './BlockRenderer';
import type { MediaMap } from './media';
import type { SlidersMap, FormsMap, PostListsMap, DocumentsMap } from './data-maps';

export interface ColumnComponentProps {
  readonly block: ColumnBlock;
  readonly media?: MediaMap | undefined;
  readonly sliders?: SlidersMap | undefined;
  readonly forms?: FormsMap | undefined;
  readonly postLists?: PostListsMap | undefined;
  readonly documents?: DocumentsMap | undefined;
  readonly preview?: boolean | undefined;
}

export function Column({
  block,
  media,
  sliders,
  forms,
  postLists,
  documents,
  preview,
}: ColumnComponentProps) {
  return (
    <div
      className={blockClassName('column', block.props.classes)}
      style={spacingVariables(block.props.padding)}
      id={block.id}
      data-width={block.props.width}
    >
      {block.children.map((child) => (
        <BlockRenderer
          key={child.id}
          block={child}
          media={media}
          sliders={sliders}
          forms={forms}
          postLists={postLists}
          documents={documents}
          preview={preview}
        />
      ))}
    </div>
  );
}
