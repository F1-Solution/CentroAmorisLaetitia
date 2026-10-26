'use client';

import { use } from 'react';
import { DocumentEditor } from '../../../../components/documents/DocumentEditor';

/** Scheda di un documento scaricabile: titolo, descrizione e file. */
export default function DocumentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const { id } = use(params);
  return <DocumentEditor documentId={id} />;
}
