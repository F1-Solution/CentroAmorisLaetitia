'use client';

import { use } from 'react';
import { ContentEditor } from '../../../../components/editor/ContentEditor';
import { AreaGate } from '../../../../components/AreaShell';

/** Editor di una pagina. */
export default function PaginaEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const { id } = use(params);
  return (
    <AreaGate area="redazione">
      <ContentEditor
        contentId={id}
        sectionId="pagine"
        listHref="/redazione/pagine"
        listLabel="Pagine"
      />
    </AreaGate>
  );
}
