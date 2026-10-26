'use client';

import { DataTable, PageHeader } from '@amoris/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AreaShell } from '../AreaShell';
import { listSliders, messageOf, type SliderSummary } from './sliderModel';

/** Schermata «Caroselli»: i caroselli del sito, con quante immagini hanno e in quante pagine compaiono. */
export function SliderList(): React.JSX.Element {
  const [sliders, setSliders] = useState<readonly SliderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setSliders(await listSliders(controller.signal));
        setError(null);
      } catch (caught) {
        if (!controller.signal.aborted) setError(messageOf(caught));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <AreaShell
      area="redazione"
      sectionId="caroselli"
      breadcrumbs={[{ label: 'Redazione', href: '/redazione/pagine' }, { label: 'Caroselli' }]}
    >
      <PageHeader
        title="Caroselli"
        summary="Le presentazioni a scorrimento del sito: se ne cambiano immagini, ordine e testi."
      />

      <DataTable<SliderSummary>
        caption="Caroselli"
        rows={[...sliders]}
        getRowId={(row) => row.id}
        loading={loading}
        {...(error ? { errorText: error } : {})}
        emptyText="Non ci sono caroselli."
        columns={[
          {
            key: 'title',
            header: 'Titolo',
            render: (row) => <Link href={`/redazione/caroselli/${row.id}`}>{row.title}</Link>,
          },
          {
            key: 'slideCount',
            header: 'Immagini',
            numeric: true,
            render: (row) => String(row.slideCount),
          },
          {
            key: 'usedInCount',
            header: 'Pagine che lo mostrano',
            numeric: true,
            render: (row) => String(row.usedInCount),
          },
        ]}
      />
    </AreaShell>
  );
}
