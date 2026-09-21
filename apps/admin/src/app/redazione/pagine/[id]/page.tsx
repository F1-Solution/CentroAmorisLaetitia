'use client';

import { use } from 'react';
import { ContentEditor } from '../../../../components/editor/ContentEditor';

/** Editor di una pagina. */
export default function PaginaEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const { id } = use(params);
  return (
    <ContentEditor contentId={id} sectionId="pagine" listHref="/redazione/pagine" listLabel="Pagine" />
  );
}
