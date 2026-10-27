'use client';

import { BlocksDocument, type BlockDocument } from '@amoris/blocks';
import { PreviewPane, type PreviewViewport } from '@amoris/ui';

export interface EditorPreviewProps {
  readonly document: BlockDocument;
  readonly viewport: PreviewViewport;
  readonly onViewportChange: (viewport: PreviewViewport) => void;
}

/**
 * L'anteprima, e il motivo per cui è tre righe.
 *
 * ADR-006 §3.3: «L'anteprima usa **gli stessi componenti di resa del sito
 * pubblico**, non una riproduzione approssimata dentro l'editor. Un'anteprima
 * che diverge dal sito è peggio di nessuna anteprima, perché fa approvare
 * modifiche sbagliate.»
 *
 * Detto in codice: `BlocksDocument` arriva da `@amoris/blocks`, il pacchetto
 * condiviso, e qui **non esiste alcun componente di resa**. Se un giorno ne
 * comparisse uno, il criterio di uscita 22 — verificato «dal grafo delle
 * importazioni, non a occhio» — lo troverebbe: il controllo è in
 * `tests/preview-import-graph.test.ts`.
 *
 * `PreviewPane` è solo la cornice — commutatore schermo/telefono e stati — e
 * non sa nulla di blocchi: `packages/ui` non importa da `packages/blocks`.
 */
export function EditorPreview({
  document,
  viewport,
  onViewportChange,
}: EditorPreviewProps): React.JSX.Element {
  return (
    <PreviewPane viewport={viewport} onViewportChange={onViewportChange}>
      <BlocksDocument document={document} preview />
    </PreviewPane>
  );
}
