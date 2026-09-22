'use client';

import { PageHeader, Tabs } from '@amoris/ui';
import { useState } from 'react';
import { AreaShell } from '../AreaShell';
import { RedirectTable } from './RedirectTable';
import { SeoTemplates } from './SeoTemplates';
import './SeoAndRedirects.css';

/**
 * «SEO e indirizzi»: i template globali e i redirect.
 *
 * La SEO del **singolo contenuto** non sta qui ma dentro l'editor del contenuto
 * (DR-076): si scrive mentre si scrive la pagina, non in una seconda schermata
 * che costringerebbe a tenere due elenchi di contenuti allineati.
 */
export function SeoAndRedirects(): React.JSX.Element {
  const [tab, setTab] = useState('template');

  return (
    <AreaShell
      area="redazione"
      sectionId="seo"
      breadcrumbs={[
        { label: 'Redazione', href: '/redazione/pagine' },
        { label: 'SEO e indirizzi' },
      ]}
    >
      <PageHeader
        title="SEO e indirizzi"
        summary="I template dei titoli e delle descrizioni, e i reindirizzamenti degli indirizzi storici."
      />

      <Tabs
        tabs={[
          { key: 'template', label: 'Template globali' },
          { key: 'redirect', label: 'Redirect' },
        ]}
        activeKey={tab}
        onChange={setTab}
      >
        {tab === 'template' ? <SeoTemplates /> : <RedirectTable />}
      </Tabs>
    </AreaShell>
  );
}
