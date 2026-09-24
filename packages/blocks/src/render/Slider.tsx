import type { SliderBlock } from '../schema/block';
import { blockClassName } from './class-name';

export interface SliderComponentProps {
  readonly block: SliderBlock;
}

export function Slider({ block }: SliderComponentProps) {
  return (
    <div
      className={blockClassName('slider', block.props.classes)}
      id={block.id}
      data-slider-id={block.props.sliderId}
    />
  );
}
