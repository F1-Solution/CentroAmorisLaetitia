import type { RowBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { spacingVariables } from './spacing';
import { BlockRenderer } from './BlockRenderer';
import type { MediaMap } from './media';
import type { SlidersMap, FormsMap, PostListsMap } from './data-maps';

export interface RowComponentProps {
  readonly block: RowBlock;
  readonly media?: MediaMap | undefined;
  readonly sliders?: SlidersMap | undefined;
  readonly forms?: FormsMap | undefined;
  readonly postLists?: PostListsMap | undefined;
}

export function Row({ block, media, sliders, forms, postLists }: RowComponentProps) {
  return (
    <div
      className={blockClassName('row', block.props.classes)}
      style={spacingVariables(block.props.padding)}
      id={block.id}
    >
      {block.children.map((child) => (
        <BlockRenderer
          key={child.id}
          block={child}
          media={media}
          sliders={sliders}
          forms={forms}
          postLists={postLists}
        />
      ))}
    </div>
  );
}
