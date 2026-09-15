import type { BlockDocument } from '../schema/document.js';
import { BlockRenderer } from './BlockRenderer.js';

export interface BlocksDocumentProps {
  readonly document: BlockDocument;
}

/** Rende un documento a blocchi per intero: il punto d'ingresso del pacchetto. */
export function BlocksDocument({ document }: BlocksDocumentProps) {
  return (
    <>
      {document.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </>
  );
}
