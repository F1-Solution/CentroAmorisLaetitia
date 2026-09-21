import type { SeparatorBlock } from '../schema/block';
import { blockClassName } from './class-name';

export interface SeparatorComponentProps {
  readonly block: SeparatorBlock;
}

export function Separator({ block }: SeparatorComponentProps) {
  return <hr className={blockClassName('separator', block.props.classes)} id={block.id} />;
}
