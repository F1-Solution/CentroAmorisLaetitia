'use client';

import { ContentList } from '../../../components/ContentList';

/** Notizie: stesso elenco delle pagine, sull'altro tipo di contenuto. */
export default function NotiziePage(): React.JSX.Element {
  return (
    <ContentList
      type="post"
      sectionId="notizie"
      title="Notizie"
      summary="Gli articoli del sito pubblico."
      searchLabel="Cerca fra le notizie"
      emptyText="Nessuna notizia corrisponde a questi filtri."
      caption="Notizie del sito"
    />
  );
}
