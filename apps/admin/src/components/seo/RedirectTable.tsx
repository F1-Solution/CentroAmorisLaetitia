'use client';

import {
  Alert,
  Button,
  CheckboxField,
  DataTable,
  Dialog,
  Pagination,
  SelectField,
  SidePanel,
  TableToolbar,
  TextArea,
  TextField,
} from '@amoris/ui';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';

/**
 * Redirect: il criterio 1D-34 — creare, modificare e disattivare.
 *
 * **Disattivare non è eliminare**, e le due azioni restano distinte anche a
 * schermo: un redirect nato dalla migrazione tiene in vita un indirizzo storico,
 * e spegnerlo per prova è reversibile mentre cancellarlo non lo è.
 */

interface Redirect {
  readonly id: string;
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly statusCode: number;
  readonly kind: 'exact' | 'prefix';
  readonly origin: 'migration' | 'manual' | 'automatic';
  readonly isActive: boolean;
  readonly note: string | null;
  readonly hitCount: number;
  readonly lastHitAt: string | null;
}

interface ListResponse {
  readonly items: readonly Redirect[];
  readonly meta: { readonly total: number; readonly page: number; readonly perPage: number };
}

const ACTIVE_OPTIONS = [
  { value: '', label: 'Attivi e spenti' },
  { value: 'true', label: 'Solo attivi' },
  { value: 'false', label: 'Solo spenti' },
];

const STATUS_OPTIONS = [
  { value: '301', label: '301 — permanente' },
  { value: '302', label: '302 — temporaneo' },
  { value: '307', label: '307 — temporaneo, metodo conservato' },
  { value: '308', label: '308 — permanente, metodo conservato' },
];

const KIND_OPTIONS = [
  { value: 'exact', label: 'Indirizzo esatto' },
  { value: 'prefix', label: 'Indirizzo e tutto ciò che sta sotto' },
];

const ORIGIN_LABEL: Readonly<Record<Redirect['origin'], string>> = {
  migration: 'Migrazione',
  manual: 'Scritto a mano',
  automatic: 'Automatico',
};

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.message
    : 'Non è stato possibile contattare il servizio.';
}

export function RedirectTable(): React.JSX.Element {
  const { user } = useSession();
  const canWrite = user?.permissions.includes('settings.write') ?? false;

  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [editing, setEditing] = useState<Redirect | null>(null);
  const [draft, setDraft] = useState({
    sourcePath: '',
    targetPath: '',
    statusCode: '301',
    kind: 'exact',
    note: '',
    isActive: true,
  });
  const [panelError, setPanelError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (signal: AbortSignal) => {
      const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
      if (active) query.set('active', active);
      if (search.trim()) query.set('search', search.trim());
      setLoading(true);
      try {
        setData(await api<ListResponse>(`/redirects?${query.toString()}`, { signal }));
        setError(null);
      } catch (caught) {
        if (signal.aborted) return;
        setError(messageOf(caught));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, perPage, search, active],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load, reloadToken]);

  function openNew(): void {
    setEditing(null);
    setDraft({
      sourcePath: '',
      targetPath: '',
      statusCode: '301',
      kind: 'exact',
      note: '',
      isActive: true,
    });
    setPanelError(null);
    setCreating(true);
  }

  function openExisting(row: Redirect): void {
    setEditing(row);
    setDraft({
      sourcePath: row.sourcePath,
      targetPath: row.targetPath,
      statusCode: String(row.statusCode),
      kind: row.kind,
      note: row.note ?? '',
      isActive: row.isActive,
    });
    setPanelError(null);
  }

  async function save(): Promise<void> {
    setBusy(true);
    setPanelError(null);
    const body = {
      sourcePath: draft.sourcePath,
      targetPath: draft.targetPath,
      statusCode: Number(draft.statusCode),
      kind: draft.kind,
      note: draft.note.trim() || null,
    };
    try {
      if (editing) {
        await api(`/redirects/${editing.id}`, {
          method: 'PATCH',
          body: { ...body, isActive: draft.isActive },
        });
      } else {
        await api('/redirects', { method: 'POST', body });
      }
      setEditing(null);
      setCreating(false);
      setReloadToken((token) => token + 1);
    } catch (caught) {
      setPanelError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <>
      {panelError ? (
        <Alert variant="error" title="Non è stato possibile">
          {panelError}
        </Alert>
      ) : null}
      <TextField
        label="Indirizzo di partenza"
        value={draft.sourcePath}
        disabled={!canWrite || busy}
        helpText="Comincia con una barra, per esempio /vecchia-pagina."
        onChange={(event) => setDraft({ ...draft, sourcePath: event.target.value })}
      />
      <TextField
        label="Indirizzo di arrivo"
        value={draft.targetPath}
        disabled={!canWrite || busy}
        onChange={(event) => setDraft({ ...draft, targetPath: event.target.value })}
      />
      <SelectField
        label="Tipo di risposta"
        value={draft.statusCode}
        options={STATUS_OPTIONS}
        disabled={!canWrite || busy}
        onChange={(event) => setDraft({ ...draft, statusCode: event.target.value })}
      />
      <SelectField
        label="Che cosa copre"
        value={draft.kind}
        options={KIND_OPTIONS}
        disabled={!canWrite || busy}
        onChange={(event) => setDraft({ ...draft, kind: event.target.value })}
      />
      <TextArea
        label="Nota"
        value={draft.note}
        disabled={!canWrite || busy}
        helpText="A che cosa serve questo redirect. La legge chi lo troverà fra un anno."
        onChange={(event) => setDraft({ ...draft, note: event.target.value })}
      />
      {editing ? (
        <CheckboxField
          label="Attivo"
          checked={draft.isActive}
          disabled={!canWrite || busy}
          onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
        />
      ) : null}
      <div className="amoris-seo__actions">
        <Button variant="primary" permitted={canWrite} loading={busy} onClick={() => void save()}>
          {editing ? 'Salva il redirect' : 'Crea il redirect'}
        </Button>
      </div>
    </>
  );

  return (
    <>
      <div className="amoris-seo__toolbar-row">
        <TableToolbar
          searchLabel="Cerca fra i redirect"
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          filters={[
            {
              key: 'active',
              label: 'Stato',
              value: active,
              options: ACTIVE_OPTIONS,
              onChange: (value: string) => {
                setActive(value);
                setPage(1);
              },
            },
          ]}
          onResetFilters={() => {
            setSearch('');
            setActive('');
            setPage(1);
          }}
        />
        <Button variant="primary" permitted={canWrite} onClick={openNew}>
          Nuovo redirect
        </Button>
      </div>

      <DataTable<Redirect>
        caption="Redirect"
        rows={[...(data?.items ?? [])]}
        getRowId={(row) => row.id}
        loading={loading}
        {...(error ? { errorText: error } : {})}
        emptyText="Nessun redirect corrisponde a questi filtri."
        columns={[
          {
            key: 'sourcePath',
            header: 'Da',
            render: (row) => (
              <button
                type="button"
                className="amoris-focusable amoris-seo__link"
                onClick={() => openExisting(row)}
              >
                {row.sourcePath}
              </button>
            ),
          },
          { key: 'targetPath', header: 'A', render: (row) => row.targetPath },
          { key: 'statusCode', header: 'Risposta', numeric: true, render: (row) => row.statusCode },
          { key: 'origin', header: 'Origine', render: (row) => ORIGIN_LABEL[row.origin] },
          {
            key: 'isActive',
            header: 'Stato',
            render: (row) => (row.isActive ? 'Attivo' : 'Spento'),
          },
          { key: 'hitCount', header: 'Usi', numeric: true, render: (row) => row.hitCount },
        ]}
      />

      <Pagination
        page={data?.meta.page ?? page}
        totalItems={data?.meta.total ?? 0}
        pageSize={perPage}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPerPage(size);
          setPage(1);
        }}
        disabled={loading}
      />

      {editing ? (
        <SidePanel open onClose={() => setEditing(null)} title={editing.sourcePath}>
          {form}
        </SidePanel>
      ) : null}

      {creating ? (
        <Dialog open onClose={() => setCreating(false)} title="Nuovo redirect">
          {form}
        </Dialog>
      ) : null}
    </>
  );
}
