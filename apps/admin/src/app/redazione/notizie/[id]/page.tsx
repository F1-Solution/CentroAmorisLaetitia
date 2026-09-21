'use client';

import { use } from 'react';
import { ContentEditor } from '../../../../components/editor/ContentEditor';

/** Editor di una notizia. Stessa schermata delle pagine: `contents` e' una tabella sola. */
export default function NotiziaEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const { id } = use(params);
  return (
    <ContentEditor
      contentId={id}
      sectionId="notizie"
      listHref="/redazione/notizie"
      listLabel="Notizie"
    />
  );
}
