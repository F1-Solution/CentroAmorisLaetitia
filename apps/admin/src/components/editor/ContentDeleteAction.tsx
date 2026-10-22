'use client';

import { Alert, Button, ConfirmDestructive, Dialog } from '@amoris/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';

/**
 * «Elimina» nell'intestazione dell'editor: anteprima degli impedimenti, poi conferma
 * scrivendo il titolo (S7, D142-A).
 */

interface DeletionPreview {
  readonly blocked: boolean;
  readonly children: readonly { id: string; title: string; path: string }[];
  readonly menuItems: readonly { id: string; label: string; menu: string }[];
  readonly isHome: boolean;
  readonly redirectsToPath: readonly { source: string }[];
}

export interface ContentDeleteActionProps {
  readonly contentId: string;
  readonly title: string;
  readonly published: boolean;
  readonly canPublish: boolean;
  readonly disabled: boolean;
  /** L'elenco a cui si torna, con l'indicatore dell'avviso nell'indirizzo. */
  readonly listHref: string;
}

function errorText(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.fullMessage : fallback;
}

function confirmDescription(preview: DeletionPreview): string {
  const base =
    'Il contenuto sparisce con la sua copia di lavoro, i dati SEO e i legami alle categorie; il registro conserva titolo e indirizzo. Il suo indirizzo risponderà «pagina non trovata».';
  if (preview.redirectsToPath.length === 0) return base;
  const sources = preview.redirectsToPath.map((rule) => rule.source).join(', ');
  return `${base} Le regole di redirect verso questo indirizzo restano (${sources}): porteranno a «pagina non trovata» e si sistemano dalla pagina dei redirect.`;
}

function BlockedReasons({ preview }: { readonly preview: DeletionPreview }): React.JSX.Element {
  return (
    <>
      {preview.children.length > 0 ? (
        <>
          <p>Ha delle pagine figlie: vanno spostate o eliminate prima.</p>
          <ul>
            {preview.children.map((child) => (
              <li key={child.id}>
                {child.title} ({child.path})
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
      {preview.isHome ? (
        <p>È la pagina iniziale del sito: indica prima un’altra pagina iniziale.</p>
      ) : null}
    </>
  );
}

export function ContentDeleteAction({
  contentId,
  title,
  published,
  canPublish,
  disabled,
  listHref,
}: ContentDeleteActionProps): React.JSX.Element | null {
  const router = useRouter();
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (disabled) return null;
  if (published && !canPublish) {
    return (
      <p className="amoris-editor__delete-note">
        Per eliminare un contenuto pubblicato serve il permesso di pubblicare.
      </p>
    );
  }

  async function check(): Promise<void> {
    setChecking(true);
    setCheckError(null);
    setDeleteError(null);
    try {
      setPreview(await api<DeletionPreview>(`/contents/${contentId}/deletion`));
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
      await api(`/contents/${contentId}`, { method: 'DELETE' });
      // Solo un indicatore costante: il titolo nell'indirizzo finirebbe in cronologia e nei log (H-1).
      router.push(`${listHref}?eliminato=1`);
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
          title="Elimina il contenuto"
          description={confirmDescription(preview)}
          objectName={title}
          loading={deleting}
          {...(deleteError ? { errorText: deleteError } : {})}
        />
      ) : null}
    </>
  );
}
