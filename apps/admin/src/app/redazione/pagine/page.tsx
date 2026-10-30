'use client';

import { ContentList } from '../../../components/ContentList';
import { AreaGate } from '../../../components/AreaShell';

/** Pagine del sito pubblico. */
export default function PaginePage(): React.JSX.Element {
  return (
    <AreaGate area="redazione">
      <ContentList
        type="page"
        sectionId="pagine"
        title="Pagine"
        summary="Le pagine del sito pubblico."
        searchLabel="Cerca fra le pagine"
        emptyText="Nessuna pagina corrisponde a questi filtri."
        caption="Pagine del sito"
        basePath="/redazione/pagine"
        createLabel="Nuova pagina"
      />
    </AreaGate>
  );
}
