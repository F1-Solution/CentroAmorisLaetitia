'use client';

import { Alert, Button, DataTable, SidePanel, TextArea, TextField } from '@amoris/ui';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';

/**
 * Template SEO globali, uno per ambito.
 *
 * Non si creano da qui e non si eliminano: gli ambiti sono quelli che il sito
 * rende — home, pagina, articolo, categoria, allegato, ricerca — e inventarne
 * uno nuovo produrrebbe una regola che nessun template consuma. Si modificano,
 * che è ciò che il criterio 1D-33 chiede.
 */

export interface SeoTemplate {
  readonly scope: string;
  readonly titleTemplate: string;
  readonly descriptionTemplate: string | null;
  readonly robotsDirectives: readonly string[];
  readonly ogType: string | null;
  readonly schemaType: string | null;
  readonly updatedAt: string;
}

const SCOPE_LABEL: Readonly<Record<string, string>> = {
  home: 'Pagina iniziale',
  page: 'Pagine',
  post: 'Notizie',
  category: 'Categorie',
  attachment: 'Allegati',
  search: 'Risultati di ricerca',
};

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.message
    : 'Non è stato possibile contattare il servizio.';
}

export function SeoTemplates(): React.JSX.Element {
  const { user } = useSession();
  const canWrite = user?.permissions.includes('settings.write') ?? false;

  const [rows, setRows] = useState<readonly SeoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SeoTemplate | null>(null);
  const [draft, setDraft] = useState({ title: '', description: '', robots: '', ogType: '' });
  const [panelError, setPanelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<SeoTemplate[]>('/seo/templates'));
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function open(row: SeoTemplate): void {
    setEditing(row);
    setDraft({
      title: row.titleTemplate,
      description: row.descriptionTemplate ?? '',
      robots: row.robotsDirectives.join(', '),
      ogType: row.ogType ?? '',
    });
    setPanelError(null);
  }

  async function save(): Promise<void> {
    if (!editing) return;
    setBusy(true);
    setPanelError(null);
    try {
      await api(`/seo/templates/${encodeURIComponent(editing.scope)}`, {
        method: 'PUT',
        body: {
          titleTemplate: draft.title,
          descriptionTemplate: draft.description.trim() || null,
          robotsDirectives: draft.robots
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
          ogType: draft.ogType.trim() || null,
          schemaType: editing.schemaType,
        },
      });
      setEditing(null);
      await load();
    } catch (caught) {
      setPanelError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DataTable<SeoTemplate>
        caption="Template SEO globali"
        rows={[...rows]}
        getRowId={(row) => row.scope}
        loading={loading}
        {...(error ? { errorText: error } : {})}
        emptyText="Nessun template globale."
        columns={[
          {
            key: 'scope',
            header: 'Ambito',
            render: (row) => (
              <button
                type="button"
                className="amoris-focusable amoris-seo__link"
                onClick={() => open(row)}
              >
                {SCOPE_LABEL[row.scope] ?? row.scope}
              </button>
            ),
          },
          { key: 'titleTemplate', header: 'Titolo', render: (row) => row.titleTemplate },
          {
            key: 'descriptionTemplate',
            header: 'Descrizione',
            render: (row) => row.descriptionTemplate ?? '—',
          },
          {
            key: 'robotsDirectives',
            header: 'Direttive robots',
            render: (row) => (row.robotsDirectives.length > 0 ? row.robotsDirectives.join(', ') : '—'),
          },
        ]}
      />

      {editing ? (
        <SidePanel
          open
          onClose={() => setEditing(null)}
          title={SCOPE_LABEL[editing.scope] ?? editing.scope}
        >
          {panelError ? (
            <Alert variant="error" title="Non è stato possibile">
              {panelError}
            </Alert>
          ) : null}

          <TextField
            label="Template del titolo"
            value={draft.title}
            disabled={!canWrite || busy}
            helpText="I segnaposto fra graffe vengono sostituiti dal sito: {title}, {site_title}, {term_title}, {query}."
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
          <TextArea
            label="Template della descrizione"
            value={draft.description}
            disabled={!canWrite || busy}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
          <TextField
            label="Direttive robots"
            value={draft.robots}
            disabled={!canWrite || busy}
            helpText="Separate da una virgola, per esempio: noindex, nofollow."
            onChange={(event) => setDraft({ ...draft, robots: event.target.value })}
          />
          <TextField
            label="Tipo Open Graph"
            value={draft.ogType}
            disabled={!canWrite || busy}
            onChange={(event) => setDraft({ ...draft, ogType: event.target.value })}
          />

          <div className="amoris-seo__actions">
            <Button variant="primary" permitted={canWrite} loading={busy} onClick={() => void save()}>
              Salva il template
            </Button>
          </div>
        </SidePanel>
      ) : null}
    </>
  );
}
