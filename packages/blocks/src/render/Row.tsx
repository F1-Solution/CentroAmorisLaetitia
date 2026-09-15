import type { RowBlock } from '../schema/block.js';
import { blockClassName } from './class-name.js';
import { BlockRenderer } from './BlockRenderer.js';

export interface RowComponentProps {
  readonly block: RowBlock;
}

export function Row({ block }: RowComponentProps) {
  return (
    <div className={blockClassName('row', block.props.classes)} id={block.id}>
      {block.children.map((child) => (
        <BlockRenderer key={child.id} block={child} />
      ))}
    </div>
  );
}
