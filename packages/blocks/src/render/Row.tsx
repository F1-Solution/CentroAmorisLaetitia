import type { RowBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { spacingVariables } from './spacing';
import { BlockRenderer } from './BlockRenderer';
import type { MediaMap } from './media';

export interface RowComponentProps {
  readonly block: RowBlock;
  readonly media?: MediaMap | undefined;
}

export function Row({ block, media }: RowComponentProps) {
  return (
    <div
      className={blockClassName('row', block.props.classes)}
      style={spacingVariables(block.props.padding)}
      id={block.id}
    >
      {block.children.map((child) => (
        <BlockRenderer key={child.id} block={child} media={media} />
      ))}
    </div>
  );
}
