'use client';

import { Alert, Button, DataTable, PageHeader } from '@amoris/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { siteUrl } from '../../lib/siteUrl';
import { AreaShell } from '../AreaShell';
import { humanSize } from '../media/MediaLibrary';
import { DocumentCreateDialog } from './DocumentCreateDialog';
import { lastUpdate, messageOf, takeArrivalFlag, type EditorialDocument } from './documentModel';

/** Schermata «Documenti»: i documenti scaricabili del sito, con il collegamento alla scheda e alla pagina pubblica. */
export function DocumentList(): React.JSX.Element {
  const { user } = useSession();
  // DR-281: creare tocca anche il file e pubblica subito il documento (DR-242).
  const canCreate = ['content.write', 'media.write', 'content.publish'].every(
    (permission) => user?.permissions.includes(permission) ?? false,
  );
  const [creating, setCreating] = useState(false);
  const [documents, setDocuments] = useState<readonly EditorialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // Dopo «Elimina» nella scheda si arriva qui con l'indicatore, letto una volta sola.
  useEffect(() => {
    if (takeArrivalFlag('eliminato')) setRemoved(true);
  }, []);

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
        summary="I documenti scaricabili del sito: se ne creano di nuovi e se ne cambiano titolo, descrizione e file."
        action={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Nuovo documento
            </Button>
          ) : undefined
        }
      />

      {removed ? (
        <Alert variant="success" title="Fatto">
          Documento eliminato.
        </Alert>
      ) : null}

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

      {creating ? <DocumentCreateDialog onClose={() => setCreating(false)} /> : null}
    </AreaShell>
  );
}
