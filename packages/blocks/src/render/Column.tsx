import type { ColumnBlock } from '../schema/block.js';
import { blockClassName } from './class-name.js';
import { BlockRenderer } from './BlockRenderer.js';

export interface ColumnComponentProps {
  readonly block: ColumnBlock;
}

export function Column({ block }: ColumnComponentProps) {
  return (
    <div className={blockClassName('column', block.props.classes)} id={block.id}>
      {block.children.map((child) => (
        <BlockRenderer key={child.id} block={child} />
      ))}
    </div>
  );
}
