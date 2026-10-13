import type { SectionBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { spacingVariables } from './spacing';
import { BlockRenderer } from './BlockRenderer';
import type { MediaMap } from './media';
import type { SlidersMap, FormsMap, PostListsMap } from './data-maps';

export interface SectionComponentProps {
  readonly block: SectionBlock;
  readonly media?: MediaMap | undefined;
  readonly sliders?: SlidersMap | undefined;
  readonly forms?: FormsMap | undefined;
  readonly postLists?: PostListsMap | undefined;
}

/** Resa di `section` (`BLOCK-MODEL.md` §6.2). Condivisa da sito e anteprima (ADR-006 §3.3). */
export function Section({ block, media, sliders, forms, postLists }: SectionComponentProps) {
  return (
    <section
      className={blockClassName('section', block.props.classes)}
      style={spacingVariables(block.props.padding)}
      id={block.id}
    >
      {block.children.map((child) => (
        <BlockRenderer
          key={child.id}
          block={child}
          media={media}
          sliders={sliders}
          forms={forms}
          postLists={postLists}
        />
      ))}
    </section>
  );
}
