import type { SectionBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { spacingVariables } from './spacing';
import { BlockRenderer } from './BlockRenderer';
import type { MediaMap } from './media';

export interface SectionComponentProps {
  readonly block: SectionBlock;
  readonly media?: MediaMap | undefined;
}

/** Resa di `section` (`BLOCK-MODEL.md` §6.2). Condivisa da sito e anteprima (ADR-006 §3.3). */
export function Section({ block, media }: SectionComponentProps) {
  return (
    <section
      className={blockClassName('section', block.props.classes)}
      style={spacingVariables(block.props.padding)}
      id={block.id}
    >
      {block.children.map((child) => (
        <BlockRenderer key={child.id} block={child} media={media} />
      ))}
    </section>
  );
}
