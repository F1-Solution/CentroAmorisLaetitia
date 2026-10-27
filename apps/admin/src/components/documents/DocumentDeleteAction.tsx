'use client';

import { Alert, Button, ConfirmDestructive, Dialog } from '@amoris/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';

/**
 * «Elimina» nella scheda di un documento (DR-281): anteprima di ciò che lo trattiene, poi
 * conferma scrivendo il titolo, come «Elimina» dei contenuti.
 */

interface DocumentDeletion {
  readonly blocked: boolean;
  readonly contents: readonly { id: string; title: string; path: string }[];
  readonly menuItems: readonly { id: string; label: string; menu: string }[];
  readonly redirectsToPath: readonly { source: string }[];
  readonly fileShared: boolean;
}

const errorText = (caught: unknown, fallback: string): string =>
  caught instanceof ApiError ? caught.fullMessage : fallback;

function confirmDescription(preview: DocumentDeletion): string {
  const file = preview.fileShared
    ? 'Il file PDF resta, perché è usato anche altrove.'
    : 'Il file PDF sparisce dall’archivio e il suo indirizzo risponde «pagina non trovata».';
  const base = `La pagina del documento e la sua voce nell’elenco della categoria risponderanno «pagina non trovata»; il registro conserva titolo e indirizzo. ${file}`;
  if (preview.redirectsToPath.length === 0) return base;
  const sources = preview.redirectsToPath.map((rule) => rule.source).join(', ');
  return `${base} Le regole di redirect verso la pagina del documento restano (${sources}): porteranno a «pagina non trovata» e si sistemano dalla pagina dei redirect.`;
}

function BlockedReasons({ preview }: { readonly preview: DocumentDeletion }): React.JSX.Element {
  return (
    <>
      {preview.contents.length > 0 ? (
        <>
          <p>È citato da un blocco «Documento»: il blocco va tolto prima.</p>
          <ul>
            {preview.contents.map((content) => (
              <li key={content.id}>
                {content.title} ({content.path})
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {preview.menuItems.length > 0 ? (
        <>
          <p>È usato in un menu: le voci vanno tolte prima dal menu.</p>
          <ul>
            {preview.menuItems.map((item) => (
              <li key={item.id}>
                {item.label}, nel menu {item.menu}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

export interface DocumentDeleteActionProps {
  readonly documentId: string;
  readonly title: string;
}

export function DocumentDeleteAction({
  documentId,
  title,
}: DocumentDeleteActionProps): React.JSX.Element {
  const router = useRouter();
  const [preview, setPreview] = useState<DocumentDeletion | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function check(): Promise<void> {
    setChecking(true);
    setCheckError(null);
    setDeleteError(null);
    try {
      setPreview(await api<DocumentDeletion>(`/documents/${documentId}/deletion`));
    } catch (caught) {
      setCheckError(errorText(caught, 'Non è stato possibile controllare l’eliminazione.'));
    } finally {
      setChecking(false);
    }
  }

  async function remove(): Promise<void> {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/documents/${documentId}`, { method: 'DELETE' });
      router.push('/redazione/documenti');
    } catch (caught) {
      setDeleteError(errorText(caught, 'L’eliminazione non è riuscita.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button variant="destructive" loading={checking} onClick={() => void check()}>
        Elimina
      </Button>
      {checkError ? (
        <Alert variant="error" title="Eliminazione non controllata">
          {checkError}
        </Alert>
      ) : null}
      {preview?.blocked ? (
        <Dialog open onClose={() => setPreview(null)} title="Non si può eliminare">
          <BlockedReasons preview={preview} />
        </Dialog>
      ) : null}
      {preview && !preview.blocked ? (
        <ConfirmDestructive
          open
          onClose={() => setPreview(null)}
          onConfirm={() => void remove()}
          title="Elimina il documento"
          description={confirmDescription(preview)}
          objectName={title}
          loading={deleting}
          {...(deleteError ? { errorText: deleteError } : {})}
        />
      ) : null}
    </>
  );
}
