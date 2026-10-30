'use client';

import { Alert, Button, DataTable, Dialog, PageHeader, TextField } from '@amoris/ui';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';
import { slugFromTitle } from '../ContentList';
import { AreaShell } from '../AreaShell';
import { CategoryDeleteAction } from './CategoryDeleteAction';
import { CategoryEditDialog, type CategoryRow, type CategoryWarning } from './CategoryEditDialog';
import './CategoryManager.css';

/**
 * Schermata «Categorie»: elenco, creazione, modifica di nome, descrizione, genitrice e
 * SEO, eliminazione; lo slug resta fisso dopo la creazione (S5, S6, D140-A, DR-280).
 */

/** Una categoria come la restituisce `GET /terms?taxonomy=category`. */
type Category = CategoryRow;

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

const WARNINGS_TITLE = 'Riferimenti scritti a mano che non cambiano';

/** Gli avvisi D132-A dopo uno spostamento, con le parole dell'editor dei contenuti. */
function ManualReferences({
  warnings,
}: {
  readonly warnings: readonly CategoryWarning[];
}): React.JSX.Element {
  return (
    <section aria-label={WARNINGS_TITLE}>
      <Alert variant="warning" title={WARNINGS_TITLE}>
        <ul>
          {warnings.map((warning) => (
            <li key={`${warning.kind}-${warning.id}`}>
              {warning.kind === 'canonical'
                ? `L’indirizzo canonico di un contenuto indica ancora ${warning.value}.`
                : `Una voce di menu personalizzata indica ancora ${warning.value}.`}
            </li>
          ))}
        </ul>
        <p>Non si riscrivono da soli: il redirect porta comunque al nuovo indirizzo.</p>
      </Alert>
    </section>
  );
}

export function CategoryManager(): React.JSX.Element {
  const { user } = useSession();
  const canWrite = user?.permissions.includes('content.write') ?? false;
  // DR-246: spostare ed eliminare cambiano un archivio pubblico, come per i contenuti.
  const canPublish = user?.permissions.includes('content.publish') ?? false;

  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  // Dopo una correzione a mano lo slug non segue più il nome, finché il dialogo è aperto.
  const [slugEdited, setSlugEdited] = useState(false);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});

  const [editing, setEditing] = useState<Category | null>(null);
  const [warnings, setWarnings] = useState<readonly CategoryWarning[]>([]);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function createCategory(): Promise<void> {
    setBusy(true);
    setCreateErrors({});
    try {
      await api('/terms', {
        method: 'POST',
        body: { taxonomy: 'category', name: newName, slug: newSlug },
      });
      closeCreate();
      setNotice('Categoria creata.');
      await load();
    } catch (caught) {
      setCreateErrors(fieldErrorsFrom(caught));
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
              <div className="amoris-categories__row-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setWarnings([]);
                    setNotice(null);
                    setEditing(row);
                  }}
                >
                  Modifica
                </Button>
                {canPublish ? (
                  <CategoryDeleteAction
                    id={row.id}
                    name={row.name}
                    onStart={() => setNotice(null)}
                    onDeleted={() => {
                      setNotice('Categoria eliminata.');
                      void load();
                    }}
                  />
                ) : null}
              </div>
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
              setNotice(null);
              setCreating(true);
            }}
          >
            Nuova categoria
          </Button>
        }
      />

      {notice ? (
        <Alert variant="success" title="Fatto">
          {notice}
        </Alert>
      ) : null}
      {warnings.length > 0 ? <ManualReferences warnings={warnings} /> : null}

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
      {editing ? (
        <CategoryEditDialog
          category={editing}
          categories={categories}
          canMove={canPublish}
          onClose={() => setEditing(null)}
          onSaved={(found) => {
            setEditing(null);
            setWarnings(found);
            setNotice('Modifiche salvate.');
            void load();
          }}
        />
      ) : null}
    </AreaShell>
  );
}
