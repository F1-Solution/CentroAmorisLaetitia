'use client';

import { use } from 'react';
import { DocumentEditor } from '../../../../components/documents/DocumentEditor';
import { AreaGate } from '../../../../components/AreaShell';

/** Scheda di un documento scaricabile: titolo, descrizione e file. */
export default function DocumentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const { id } = use(params);
  return (
    <AreaGate area="redazione">
      <DocumentEditor documentId={id} />
    </AreaGate>
  );
}
