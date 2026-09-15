import type { DocBlockNode } from '../schema/block.js';
import { blockClassName } from './class-name.js';

export interface DocBlockComponentProps {
  readonly block: DocBlockNode;
}

/** Nome scelto per non collidere con `BlocksDocument`, il renderer dell'intero documento. */
export function DocBlock({ block }: DocBlockComponentProps) {
  return (
    <div className={blockClassName('document', block.props.classes)} id={block.id} data-document-id={block.props.documentId}>
      {block.props.label !== null ? block.props.label : null}
    </div>
  );
}
