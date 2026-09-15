import type { RichTextBlock } from '../schema/block.js';
import { blockClassName } from './class-name.js';

export interface RichTextComponentProps {
  readonly block: RichTextBlock;
}

/**
 * `props.html` è già un punto fisso della sanificazione (`BLOCK-MODEL.md`
 * §3.4): è sicuro iniettarlo, perché è già ristretto all'elenco chiuso del §5.
 */
export function RichText({ block }: RichTextComponentProps) {
  return (
    <div
      className={blockClassName('text', block.props.classes)}
      id={block.id}
      dangerouslySetInnerHTML={{ __html: block.props.html }}
    />
  );
}
