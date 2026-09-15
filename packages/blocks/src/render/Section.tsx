import type { SectionBlock } from '../schema/block.js';
import { blockClassName } from './class-name.js';
import { BlockRenderer } from './BlockRenderer.js';

export interface SectionComponentProps {
  readonly block: SectionBlock;
}

/** Resa di `section` (`BLOCK-MODEL.md` §6.2). Condivisa da sito e anteprima (ADR-006 §3.3). */
export function Section({ block }: SectionComponentProps) {
  return (
    <section className={blockClassName('section', block.props.classes)} id={block.id}>
      {block.children.map((child) => (
        <BlockRenderer key={child.id} block={child} />
      ))}
    </section>
  );
}
