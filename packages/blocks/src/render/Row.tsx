import type { RowBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { spacingVariables } from './spacing';
import { BlockRenderer } from './BlockRenderer';

export interface RowComponentProps {
  readonly block: RowBlock;
}

export function Row({ block }: RowComponentProps) {
  return (
    <div
      className={blockClassName('row', block.props.classes)}
      style={spacingVariables(block.props.padding)}
      id={block.id}
    >
      {block.children.map((child) => (
        <BlockRenderer key={child.id} block={child} />
      ))}
    </div>
  );
}
