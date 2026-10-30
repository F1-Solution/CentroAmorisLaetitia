'use client';

import { Alert, Button, ConfirmDestructive, Dialog } from '@amoris/ui';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';

/**
 * «Elimina» di una categoria (DR-280): anteprima di ciò che la trattiene, poi conferma
 * scrivendo il nome, come «Elimina» dei contenuti.
 */

interface TermDeletion {
  readonly blocked: boolean;
  readonly contentCount: number;
  readonly children: readonly { id: string; name: string; path: string }[];
  readonly menuItems: readonly { id: string; label: string; menu: string }[];
  readonly redirectsToPath: readonly { source: string }[];
}

const errorText = (caught: unknown, fallback: string): string =>
  caught instanceof ApiError ? caught.fullMessage : fallback;

function confirmDescription(preview: TermDeletion): string {
  const base =
    'La categoria sparisce con la sua SEO; il registro conserva nome e indirizzo. Il suo archivio risponderà «pagina non trovata».';
  if (preview.redirectsToPath.length === 0) return base;
  const sources = preview.redirectsToPath.map((rule) => rule.source).join(', ');
  return `${base} Le regole di redirect verso questo indirizzo restano (${sources}): porteranno a «pagina non trovata» e si sistemano dalla pagina dei redirect.`;
}

function BlockedReasons({ preview }: { readonly preview: TermDeletion }): React.JSX.Element {
  const notizie = preview.contentCount === 1 ? '1 notizia' : `${preview.contentCount} notizie`;
  return (
    <>
      {preview.contentCount > 0 ? (
        <p>La categoria ha {notizie}, bozze comprese: assegnale prima a un’altra categoria.</p>
      ) : null}
      {preview.children.length > 0 ? (
        <>
          <p>Ha delle sottocategorie: vanno spostate o eliminate prima.</p>
          <ul>
            {preview.children.map((child) => (
              <li key={child.id}>
                {child.name} ({child.path})
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {preview.menuItems.length > 0 ? (
        <>
          <p>È usata in un menu: le voci vanno tolte prima dal menu.</p>
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

export interface CategoryDeleteActionProps {
  readonly id: string;
  readonly name: string;
  readonly onDeleted: () => void;
  /** Chiamata all'inizio di «Elimina», per togliere un avviso di riuscita precedente. */
  readonly onStart?: () => void;
}

export function CategoryDeleteAction({
  id,
  name,
  onDeleted,
  onStart,
}: CategoryDeleteActionProps): React.JSX.Element {
  const [preview, setPreview] = useState<TermDeletion | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function check(): Promise<void> {
    onStart?.();
    setChecking(true);
    setCheckError(null);
    setDeleteError(null);
    try {
      setPreview(await api<TermDeletion>(`/terms/${id}/deletion`));
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
      await api(`/terms/${id}`, { method: 'DELETE' });
      setPreview(null);
      onDeleted();
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
          title="Elimina la categoria"
          description={confirmDescription(preview)}
          objectName={name}
          loading={deleting}
          {...(deleteError ? { errorText: deleteError } : {})}
        />
      ) : null}
    </>
  );
}
