'use client';

import { Alert, Button, DataTable, Dialog, PageHeader, TextField } from '@amoris/ui';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { slugFromTitle } from '../ContentList';
import { AreaShell } from '../AreaShell';
import './CategoryManager.css';

/**
 * Schermata «Categorie»: elenco, creazione e rinomina, senza eliminazione né genitore e
 * con lo slug fisso dopo la creazione (S5, S6, S9, D140-A).
 */

/** Una categoria come la restituisce `GET /terms?taxonomy=category`. */
interface Category {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly path: string;
  readonly contentCount: number;
}

interface FieldErrors {
  readonly name?: string;
  readonly slug?: string;
  readonly general?: string;
}

const CONNECTION_ERROR = 'Non è stato possibile contattare il servizio.';

/** Smista l'errore dell'API sul campo che lo riguarda, o nel messaggio generale. */
export function fieldErrorsFrom(caught: unknown): FieldErrors {
  if (!(caught instanceof ApiError)) return { general: CONNECTION_ERROR };
  if (caught.code === 'TERM_SLUG_TAKEN') return { slug: caught.message };

  const errors: { name?: string; slug?: string } = {};
  for (const detail of caught.details) {
    const field = detail.path.replace(/^\//, '').split('.')[0];
    if (field === 'slug' && !errors.slug) errors.slug = detail.message;
    if (field === 'name' && !errors.name) errors.name = detail.message;
  }
  if (errors.slug || errors.name) return errors;
  return { general: caught.fullMessage };
}

function FormAlert({
  message,
}: {
  readonly message: string | undefined;
}): React.JSX.Element | null {
  if (!message) return null;
  return (
    <Alert variant="error" title="Non è stato salvato">
      {message}
    </Alert>
  );
}

export function CategoryManager(): React.JSX.Element {
  const { user } = useSession();
  const canWrite = user?.permissions.includes('content.write') ?? false;

  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  // Dopo una correzione a mano lo slug non segue più il nome, finché il dialogo è aperto.
  const [slugEdited, setSlugEdited] = useState(false);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});

  const [renaming, setRenaming] = useState<Category | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameErrors, setRenameErrors] = useState<FieldErrors>({});

  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await api<Category[]>('/terms?taxonomy=category'));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.fullMessage : CONNECTION_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function closeCreate(): void {
    setCreating(false);
    setCreateErrors({});
  }

  function closeRename(): void {
    setRenaming(null);
    setRenameErrors({});
  }

  async function createCategory(): Promise<void> {
    setBusy(true);
    setCreateErrors({});
    try {
      await api('/terms', {
        method: 'POST',
        body: { taxonomy: 'category', name: newName, slug: newSlug },
      });
      closeCreate();
      await load();
    } catch (caught) {
      setCreateErrors(fieldErrorsFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  async function renameCategory(category: Category): Promise<void> {
    setBusy(true);
    setRenameErrors({});
    try {
      await api(`/terms/${category.id}`, { method: 'PATCH', body: { name: renameName } });
      closeRename();
      await load();
    } catch (caught) {
      setRenameErrors(fieldErrorsFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  function renderCreateDialog(): React.JSX.Element | null {
    if (!creating) return null;
    return (
      <Dialog open onClose={closeCreate} title="Nuova categoria">
        <TextField
          label="Nome"
          value={newName}
          errorText={createErrors.name ?? ''}
          onChange={(event) => {
            setNewName(event.target.value);
            if (!slugEdited) setNewSlug(slugFromTitle(event.target.value));
          }}
        />
        <TextField
          label="Indirizzo"
          value={newSlug}
          helpText="L'ultima parte dell'indirizzo dell'archivio. Dopo la creazione non cambia."
          errorText={createErrors.slug ?? ''}
          onChange={(event) => {
            setNewSlug(event.target.value);
            setSlugEdited(true);
          }}
        />
        <FormAlert message={createErrors.general} />
        <div className="amoris-categories__dialog-actions">
          <Button variant="secondary" onClick={closeCreate} disabled={busy}>
            Annulla
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void createCategory()}>
            Crea categoria
          </Button>
        </div>
      </Dialog>
    );
  }

  function renderRenameDialog(): React.JSX.Element | null {
    if (!renaming) return null;
    return (
      <Dialog open onClose={closeRename} title="Rinomina categoria">
        <TextField
          label="Nome"
          value={renameName}
          errorText={renameErrors.name ?? ''}
          onChange={(event) => setRenameName(event.target.value)}
        />
        <p className="amoris-categories__address">
          L&apos;indirizzo dell&apos;archivio resta <strong>{renaming.path}</strong>: rinominare la
          categoria non lo cambia.
        </p>
        <FormAlert message={renameErrors.general} />
        <div className="amoris-categories__dialog-actions">
          <Button variant="secondary" onClick={closeRename} disabled={busy}>
            Annulla
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void renameCategory(renaming)}>
            Salva il nome
          </Button>
        </div>
      </Dialog>
    );
  }

  const columns = [
    { key: 'name', header: 'Nome', render: (row: Category) => row.name },
    { key: 'path', header: 'Indirizzo', render: (row: Category) => row.path },
    {
      key: 'contentCount',
      header: 'Notizie',
      numeric: true,
      render: (row: Category) => row.contentCount,
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: 'Azioni',
            render: (row: Category) => (
              <Button
                variant="secondary"
                onClick={() => {
                  setRenaming(row);
                  setRenameName(row.name);
                }}
              >
                Rinomina
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <AreaShell
      area="redazione"
      sectionId="categorie"
      breadcrumbs={[{ label: 'Redazione', href: '/redazione/pagine' }, { label: 'Categorie' }]}
    >
      <PageHeader
        title="Categorie"
        summary="Le categorie delle notizie. Ognuna ha un archivio con il proprio indirizzo."
        action={
          <Button
            permitted={canWrite}
            onClick={() => {
              setNewName('');
              setNewSlug('');
              setSlugEdited(false);
              setCreating(true);
            }}
          >
            Nuova categoria
          </Button>
        }
      />

      <DataTable<Category>
        caption="Categorie delle notizie"
        rows={[...categories]}
        getRowId={(row) => row.id}
        loading={loading}
        {...(error ? { errorText: error } : {})}
        emptyText="Non c'è ancora nessuna categoria."
        columns={columns}
      />

      {renderCreateDialog()}
      {renderRenameDialog()}
    </AreaShell>
  );
}
