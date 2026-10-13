import type { BlockDocument } from '../schema/document';
import { BlockRenderer } from './BlockRenderer';
import type { MediaMap } from './media';
import type { SlidersMap, FormsMap, PostListsMap } from './data-maps';

export interface BlocksDocumentProps {
  readonly document: BlockDocument;
  /** I media del contenuto, dalla lettura pubblica. L'anteprima non la passa. */
  readonly media?: MediaMap | undefined;
  readonly sliders?: SlidersMap | undefined;
  readonly forms?: FormsMap | undefined;
  readonly postLists?: PostListsMap | undefined;
}

/** Rende un documento a blocchi per intero: il punto d'ingresso del pacchetto. */
export function BlocksDocument({
  document,
  media,
  sliders,
  forms,
  postLists,
}: BlocksDocumentProps) {
  return (
    <>
      {document.blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          media={media}
          sliders={sliders}
          forms={forms}
          postLists={postLists}
        />
      ))}
    </>
  );
}
