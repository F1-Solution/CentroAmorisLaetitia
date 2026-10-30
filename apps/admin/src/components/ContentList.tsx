'use client';

import {
  Alert,
  Button,
  DataTable,
  Dialog,
  Pagination,
  PageHeader,
  PublishStatusBadge,
  TableToolbar,
  TextField,
  type PublishStatus,
} from '@amoris/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session';
import { AreaShell } from './AreaShell';
import './ContentList.css';

/**
 * Elenco dei contenuti, con filtri e impaginazione. Pagine e notizie sono lo
 * stesso elenco su due tipi: `contents` e' una tabella sola (ADR-005), e due
 * copie della stessa schermata divergerebbero alla prima correzione.
 *
 * I filtri e l'impaginazione **non si fanno nel browser**: la rotta `/contents`
 * li accetta e restituisce il totale, e scaricare 108 contenuti per filtrarli
 * qui sarebbe un'abitudine che non regge appena l'archivio cresce.
 */

interface ContentSummary {
  readonly id: string;
  readonly type: 'page' | 'post';
  readonly status: 'draft' | 'published' | 'archived';
  readonly title: string;
  readonly path: string;
  readonly updatedAt: string;
  readonly isHome?: boolean;
}

interface ListResponse {
  readonly items: readonly ContentSummary[];
  readonly meta: { readonly total: number; readonly page: number; readonly perPage: number };
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tutti gli stati' },
  { value: 'published', label: 'Pubblicati' },
  { value: 'draft', label: 'Bozze' },
  { value: 'archived', label: 'Archiviati' },
];

/**
 * `contents.status` ha tre valori (`database-schema.md`), la pastiglia ne
 * conosce quattro e non coincidono: «archiviato» a schermo si dice «Ritirata»,
 * che è la parola usata da ADR-006 §3.2 per la stessa operazione. Il divario
 * si colma qui e in un punto solo.
 */
const STATUS_BADGE: Record<ContentSummary['status'], PublishStatus> = {
  published: 'published',
  draft: 'draft',
  archived: 'retired',
};

function italianDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export interface ContentListProps {
  readonly type: ContentSummary['type'];
  readonly sectionId: string;
  readonly title: string;
  readonly summary: string;
  readonly searchLabel: string;
  readonly emptyText: string;
  readonly caption: string;
  /** Radice degli indirizzi dell'editor: `/redazione/pagine`, `/redazione/notizie`. */
  readonly basePath: string;
  readonly createLabel: string;
}

/**
 * Lo slug proposto a partire dal titolo. Non e' una normalizzazione «bella»:
 * l'insieme dei caratteri e' esattamente quello che `createBody` dell'API
 * ammette nel percorso, perche' proporre qualcosa che il servizio rifiuta
 * sposterebbe l'errore dopo il clic invece che prima.
 */
export function slugFromTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ContentList({
  type,
  sectionId,
  title,
  summary,
  searchLabel,
  emptyText,
  caption,
  basePath,
  createLabel,
}: ContentListProps): React.JSX.Element {
  const router = useRouter();
  const { user } = useSession();
  const canWrite = user?.permissions.includes('content.write') ?? false;
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [removed, setRemoved] = useState(false);

  // Dopo «Elimina» l'indicatore si legge una volta e si toglie dall'indirizzo, senza voce nuova in cronologia.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('eliminato')) return;
    setRemoved(url.searchParams.get('eliminato') === '1');
    url.searchParams.delete('eliminato');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  const load = useCallback(
    async (signal: AbortSignal) => {
      const query = new URLSearchParams({
        type,
        page: String(page),
        perPage: String(perPage),
      });
      if (status) query.set('status', status);
      if (search.trim()) query.set('search', search.trim());

      setLoading(true);
      try {
        setData(await api<ListResponse>(`/contents?${query.toString()}`, { signal }));
        setError(null);
      } catch (caught) {
        if (signal.aborted) return;
        setError(
          caught instanceof ApiError
            ? caught.fullMessage
            : 'Non è stato possibile contattare il servizio.',
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [type, page, perPage, search, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    // Mezzo secondo prima di interrogare: chi scrive nel campo di ricerca non
    // deve generare una richiesta per lettera.
    const timer = setTimeout(() => void load(controller.signal), 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  return (
    <AreaShell
      area="redazione"
      sectionId={sectionId}
      breadcrumbs={[{ label: 'Redazione', href: '/redazione/pagine' }, { label: title }]}
    >
      <PageHeader
        title={title}
        summary={summary}
        action={
          canWrite ? (
            <Button
              variant="primary"
              onClick={() => {
                setNewTitle('');
                setNewSlug('');
                setCreateError(null);
                setCreating(true);
              }}
            >
              {createLabel}
            </Button>
          ) : undefined
        }
      />

      {removed ? (
        <Alert variant="success" title="Contenuto eliminato">
          Il contenuto è stato eliminato definitivamente.
        </Alert>
      ) : null}

      <TableToolbar
        searchLabel={searchLabel}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          // Un filtro nuovo su una pagina che non è la prima mostrerebbe un
          // elenco vuoto senza che sia vuoto.
          setPage(1);
        }}
        filters={[
          {
            key: 'status',
            label: 'Stato',
            value: status,
            options: STATUS_OPTIONS,
            onChange: (value: string) => {
              setStatus(value);
              setPage(1);
            },
          },
        ]}
        onResetFilters={() => {
          setSearch('');
          setStatus('');
          setPage(1);
        }}
      />

      <DataTable<ContentSummary>
        caption={caption}
        rows={[...(data?.items ?? [])]}
        getRowId={(row) => row.id}
        loading={loading}
        {...(error ? { errorText: error } : {})}
        emptyText={emptyText}
        columns={[
          {
            key: 'title',
            header: 'Titolo',
            render: (row) => (
              <>
                <Link href={`${basePath}/${row.id}`}>{row.title || 'Senza titolo'}</Link>
                {row.isHome ? (
                  <span className="amoris-content-list__home"> — Pagina iniziale</span>
                ) : null}
              </>
            ),
          },
          { key: 'path', header: 'Indirizzo', render: (row) => row.path },
          {
            key: 'status',
            header: 'Stato',
            render: (row) => <PublishStatusBadge status={STATUS_BADGE[row.status]} />,
          },
          {
            key: 'updatedAt',
            header: 'Modificata',
            numeric: true,
            render: (row) => italianDate(row.updatedAt),
          },
        ]}
      />

      {creating ? (
        <Dialog open onClose={() => setCreating(false)} title={createLabel}>
          <TextField
            label="Titolo"
            value={newTitle}
            onChange={(event) => {
              setNewTitle(event.target.value);
              setNewSlug(slugFromTitle(event.target.value));
            }}
          />
          <TextField
            label="Indirizzo"
            value={newSlug}
            helpText="L'ultima parte dell'indirizzo pubblico. Si puo' correggere."
            onChange={(event) => setNewSlug(event.target.value)}
          />
          {createError ? (
            <Alert variant="error" title="Non è stato creato">
              {createError}
            </Alert>
          ) : null}
          <div className="amoris-content-list__dialog-actions">
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
              Annulla
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  setCreateError(null);
                  try {
                    // Nasce sempre in bozza, come l'API impone: creare e
                    // pubblicare sono due gesti, e il secondo e' esplicito.
                    const created = await api<{ id: string }>('/contents', {
                      method: 'POST',
                      body: { type, title: newTitle, slug: newSlug },
                    });
                    router.push(`${basePath}/${created.id}`);
                  } catch (caught) {
                    setCreateError(
                      caught instanceof ApiError
                        ? caught.fullMessage
                        : 'Non è stato possibile contattare il servizio.',
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Crea in bozza
            </Button>
          </div>
        </Dialog>
      ) : null}

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
    </AreaShell>
  );
}
