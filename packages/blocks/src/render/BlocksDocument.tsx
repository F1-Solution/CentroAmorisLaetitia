import type { BlockDocument } from '../schema/document';
import { BlockRenderer } from './BlockRenderer';
import type { MediaMap } from './media';

export interface BlocksDocumentProps {
  readonly document: BlockDocument;
  /** I media del contenuto, dalla lettura pubblica. L'anteprima non la passa. */
  readonly media?: MediaMap | undefined;
}

/** Rende un documento a blocchi per intero: il punto d'ingresso del pacchetto. */
export function BlocksDocument({ document, media }: BlocksDocumentProps) {
  return (
    <>
      {document.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} media={media} />
      ))}
    </>
  );
}
