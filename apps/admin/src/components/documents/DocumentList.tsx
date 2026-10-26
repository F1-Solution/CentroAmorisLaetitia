'use client';

import { DataTable, PageHeader } from '@amoris/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { siteUrl } from '../../lib/siteUrl';
import { AreaShell } from '../AreaShell';
import { humanSize } from '../media/MediaLibrary';
import { lastUpdate, messageOf, type EditorialDocument } from './documentModel';

/** Schermata «Documenti»: i documenti scaricabili del sito, con il collegamento alla scheda e alla pagina pubblica. */
export function DocumentList(): React.JSX.Element {
  const [documents, setDocuments] = useState<readonly EditorialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setDocuments(await api<EditorialDocument[]>('/documents', { signal: controller.signal }));
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
      sectionId="documenti"
      breadcrumbs={[{ label: 'Redazione', href: '/redazione/pagine' }, { label: 'Documenti' }]}
    >
      <PageHeader
        title="Documenti"
        summary="I documenti scaricabili del sito: se ne cambiano titolo, descrizione e file."
      />

      <DataTable<EditorialDocument>
        caption="Documenti scaricabili"
        rows={[...documents]}
        getRowId={(row) => row.id}
        loading={loading}
        {...(error ? { errorText: error } : {})}
        emptyText="Non ci sono documenti pubblici."
        columns={[
          {
            key: 'title',
            header: 'Titolo',
            render: (row) => <Link href={`/redazione/documenti/${row.id}`}>{row.title}</Link>,
          },
          { key: 'file', header: 'File', render: (row) => row.file.fileName },
          {
            key: 'byteSize',
            header: 'Peso',
            numeric: true,
            render: (row) => humanSize(row.file.byteSize),
          },
          {
            key: 'updated',
            header: 'Ultimo aggiornamento',
            numeric: true,
            render: (row) => lastUpdate(row),
          },
          {
            key: 'site',
            header: 'Sul sito',
            render: (row) => (
              <a
                href={siteUrl(row.sitePath)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Apri sul sito: ${row.title}`}
              >
                Apri sul sito
              </a>
            ),
          },
        ]}
      />
    </AreaShell>
  );
}
