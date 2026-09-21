import type { ColumnBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { BlockRenderer } from './BlockRenderer';

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
