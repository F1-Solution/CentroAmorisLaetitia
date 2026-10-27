import type { DocBlockNode } from '../schema/block';
import { blockClassName } from './class-name';
import type { DocumentsMap } from './data-maps';

export interface DocBlockComponentProps {
  readonly block: DocBlockNode;
  /** I documenti pubblici della lettura pubblica, chiave l'identificativo. */
  readonly documents?: DocumentsMap | undefined;
  /** Solo l'anteprima dell'area lo chiede: segnaposto con l'etichetta invece del collegamento. */
  readonly preview?: boolean | undefined;
}

/** Nome scelto per non collidere con `BlocksDocument`, il renderer dell'intero documento. */
export function DocBlock({ block, documents, preview = false }: DocBlockComponentProps) {
  if (preview) {
    return (
      <div
        className={blockClassName('document', block.props.classes)}
        id={block.id}
        data-document-id={block.props.documentId}
      >
        {block.props.label !== null ? block.props.label : null}
      </div>
    );
  }
  const document = documents?.[block.props.documentId];
  // Un documento riservato, eliminato o non passato non lascia traccia sul sito, mai un collegamento a un 404 (DR-287).
  if (!document) return null;
  const label = block.props.label?.trim() ? block.props.label : document.title;
  return (
    <div
      className={blockClassName('document', block.props.classes)}
      id={block.id}
      data-document-id={block.props.documentId}
    >
      <a href={`/download/${document.slug}/`}>{label}</a>
    </div>
  );
}
