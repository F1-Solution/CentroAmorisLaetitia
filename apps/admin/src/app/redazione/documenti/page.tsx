'use client';

import { DocumentList } from '../../../components/documents/DocumentList';
import { AreaGate } from '../../../components/AreaShell';

/** Documenti scaricabili del sito pubblico. */
export default function DocumentiPage(): React.JSX.Element {
  return (
    <AreaGate area="redazione">
      <DocumentList />
    </AreaGate>
  );
}
