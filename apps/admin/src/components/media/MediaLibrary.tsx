'use client';

import {
  Alert,
  Button,
  ConfirmDestructive,
  DataTable,
  Dialog,
  MediaUploader,
  PageHeader,
  Pagination,
  SidePanel,
  TableToolbar,
  TextArea,
  TextField,
  type UploadingFile,
} from '@amoris/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  checkMediaFile,
  derivedSizes,
  MEDIA_ACCEPT,
  MEDIA_ALLOWED_HINT,
} from '../../lib/mediaCheck';
import { uploadFile } from '../../lib/upload';
import { useSession } from '../../lib/session';
import { AreaShell } from '../AreaShell';
import './MediaLibrary.css';

/**
 * Archivio dei media: il criterio 1D-31 per intero — caricare, sostituire ed
 * eliminare, con testo alternativo e didascalia.
 *
 * Due cose che la schermata dichiara invece di nasconderle:
 *
 * - **la sostituzione conserva l'indirizzo** (DR-074): il file nuovo prende il
 *   posto del vecchio sulla stessa chiave, quindi ogni pagina che cita quel
 *   media continua a funzionare. Il rovescio è che il file precedente non si
 *   recupera, e la conferma lo scrive;
 * - **l'eliminazione può essere rifiutata** (DR-077): se il media è citato da
 *   un contenuto il servizio non lo elimina, e il messaggio elenca i contenuti
 *   che lo citano invece di dire soltanto «non è stato possibile».
 */

export interface MediaItem {
  readonly id: string;
  readonly publicPath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly title: string | null;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly description: string | null;
  readonly uploadedAt: string;
}

/** Esito di `PUT /media/:id/file`: il media e le dimensioni derivate scritte e tolte. */
interface ReplaceResponse extends MediaItem {
  readonly derivatives?: { readonly written: number; readonly removed: number };
}

function replaceNotice(derivatives: ReplaceResponse['derivatives']): string {
  const base =
    'File sostituito. L’indirizzo non è cambiato: le pagine che lo citano mostrano il file nuovo.';
  if (!derivatives || (derivatives.written === 0 && derivatives.removed === 0)) return base;
  const written =
    derivatives.written === 1
      ? '1 dimensione derivata rigenerata'
      : `${derivatives.written} dimensioni derivate rigenerate`;
  if (derivatives.removed === 0) return `${base} ${written}.`;
  const removed =
    derivatives.removed === 1
      ? '1 non serve più ed è stata tolta'
      : `${derivatives.removed} non servono più e sono state tolte`;
  return `${base} ${written}; ${removed}.`;
}

interface ListResponse {
  readonly items: readonly MediaItem[];
  readonly meta: { readonly total: number; readonly page: number; readonly perPage: number };
}

const TYPE_OPTIONS = [
  { value: '', label: 'Tutti i tipi' },
  { value: 'image/', label: 'Immagini' },
  { value: 'application/pdf', label: 'PDF' },
  { value: 'video/', label: 'Video' },
  { value: 'audio/', label: 'Audio' },
];

function italianDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Dimensione in unità leggibili: un numero di byte non dice nulla a nessuno. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} byte`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.fullMessage
    : 'Non è stato possibile contattare il servizio.';
}

export function MediaLibrary(): React.JSX.Element {
  const { user } = useSession();
  const canWrite = user?.permissions.includes('media.write') ?? false;

  const [search, setSearch] = useState('');
  const [mimePrefix, setMimePrefix] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [draft, setDraft] = useState({ title: '', altText: '', caption: '', description: '' });
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState<File | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const load = useCallback(
    async (signal: AbortSignal) => {
      const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
      if (mimePrefix) query.set('mimePrefix', mimePrefix);
      if (search.trim()) query.set('search', search.trim());

      setLoading(true);
      try {
        setData(await api<ListResponse>(`/media?${query.toString()}`, { signal }));
        setError(null);
      } catch (caught) {
        if (signal.aborted) return;
        setError(messageOf(caught));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, perPage, search, mimePrefix],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load, reloadToken]);

  function open(item: MediaItem): void {
    setSelected(item);
    setDraft({
      title: item.title ?? '',
      altText: item.altText ?? '',
      caption: item.caption ?? '',
      description: item.description ?? '',
    });
    setPanelError(null);
    setPanelNotice(null);
    setDeleteError(null);
  }

  async function onFilesSelected(files: FileList): Promise<void> {
    const chosen = [...files];
    setUploads(
      chosen.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name,
        progress: 0,
        status: 'uploading' as const,
      })),
    );

    // Uno per volta: l'API accetta un file per richiesta, e caricarne dieci in
    // parallelo produrrebbe dieci errori invece di dieci esiti.
    for (const [index, file] of chosen.entries()) {
      const id = `${Date.now()}-${index}`;
      const rejection = checkMediaFile(file);
      if (rejection) {
        setUploads((previous) =>
          previous.map((entry, position) =>
            position === index
              ? { ...entry, id, progress: 100, status: 'error', errorText: rejection }
              : entry,
          ),
        );
        continue;
      }
      try {
        const created = await uploadFile<MediaItem & { derivatives?: number }>('/media', file);
        const derivatives = created.derivatives ?? 0;
        setUploads((previous) =>
          previous.map((entry, position) =>
            position === index
              ? {
                  ...entry,
                  id,
                  progress: 100,
                  status: 'done',
                  ...(derivatives > 0
                    ? {
                        noticeText: `${derivedSizes(derivatives)} ${derivatives === 1 ? 'generata' : 'generate'}.`,
                      }
                    : {}),
                }
              : entry,
          ),
        );
      } catch (caught) {
        setUploads((previous) =>
          previous.map((entry, position) =>
            position === index
              ? { ...entry, id, progress: 100, status: 'error', errorText: messageOf(caught) }
              : entry,
          ),
        );
      }
    }
    reload();
  }

  /** Controlla il file scelto e, se è ammesso, chiede conferma prima di sostituire. */
  function onReplacementChosen(file: File): void {
    setPanelNotice(null);
    const rejection = checkMediaFile(file);
    if (rejection) {
      setPanelError(rejection);
      return;
    }
    setPanelError(null);
    setPendingReplacement(file);
  }

  async function onReplace(file: File): Promise<void> {
    if (!selected) return;
    setPendingReplacement(null);
    setBusy(true);
    setPanelError(null);
    setPanelNotice(null);
    try {
      const { derivatives, ...updated } = await uploadFile<ReplaceResponse>(
        `/media/${selected.id}/file`,
        file,
        { method: 'PUT' },
      );
      setSelected(updated);
      setPanelNotice(replaceNotice(derivatives));
      reload();
    } catch (caught) {
      setPanelError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveMetadata(): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setPanelError(null);
    setPanelNotice(null);
    try {
      const updated = await api<MediaItem>(`/media/${selected.id}`, {
        method: 'PATCH',
        body: {
          title: draft.title.trim() || null,
          altText: draft.altText.trim() || null,
          caption: draft.caption.trim() || null,
          description: draft.description.trim() || null,
        },
      });
      setSelected(updated);
      setPanelNotice('Modifiche salvate.');
      reload();
    } catch (caught) {
      setPanelError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await api(`/media/${selected.id}`, { method: 'DELETE' });
      setConfirming(false);
      setSelected(null);
      reload();
    } catch (caught) {
      setDeleteError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AreaShell
      area="redazione"
      sectionId="media"
      breadcrumbs={[{ label: 'Redazione', href: '/redazione/pagine' }, { label: 'Media' }]}
    >
      <PageHeader title="Media" summary="Immagini, documenti e file del sito pubblico." />

      {canWrite ? (
        <section className="amoris-media-library__upload" aria-label="Carica nuovi media">
          <MediaUploader
            files={uploads}
            accept={MEDIA_ACCEPT}
            hintText={MEDIA_ALLOWED_HINT}
            onFilesSelected={(files) => void onFilesSelected(files)}
          />
        </section>
      ) : null}

      <TableToolbar
        searchLabel="Cerca fra i media"
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          {
            key: 'mime',
            label: 'Tipo',
            value: mimePrefix,
            options: TYPE_OPTIONS,
            onChange: (value: string) => {
              setMimePrefix(value);
              setPage(1);
            },
          },
        ]}
        onResetFilters={() => {
          setSearch('');
          setMimePrefix('');
          setPage(1);
        }}
      />

      <DataTable<MediaItem>
        caption="Archivio dei media"
        rows={[...(data?.items ?? [])]}
        getRowId={(row) => row.id}
        loading={loading}
        {...(error ? { errorText: error } : {})}
        emptyText="Nessun media corrisponde a questi filtri."
        columns={[
          {
            key: 'fileName',
            header: 'File',
            render: (row) => (
              <button
                type="button"
                className="amoris-focusable amoris-media-library__name"
                onClick={() => open(row)}
              >
                {row.title ?? row.fileName}
              </button>
            ),
          },
          {
            key: 'altText',
            header: 'Testo alternativo',
            render: (row) =>
              row.altText ?? <span className="amoris-media-library__missing">Non indicato</span>,
          },
          { key: 'mimeType', header: 'Tipo', render: (row) => row.mimeType },
          {
            key: 'byteSize',
            header: 'Dimensione',
            numeric: true,
            render: (row) => humanSize(row.byteSize),
          },
          {
            key: 'uploadedAt',
            header: 'Caricato',
            numeric: true,
            render: (row) => italianDate(row.uploadedAt),
          },
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

      {selected ? (
        <SidePanel
          open
          onClose={() => setSelected(null)}
          title={selected.title ?? selected.fileName}
        >
          <dl className="amoris-media-library__facts">
            <dt>Indirizzo</dt>
            <dd>{selected.publicPath}</dd>
            <dt>Tipo</dt>
            <dd>{selected.mimeType}</dd>
            <dt>Dimensione</dt>
            <dd>{humanSize(selected.byteSize)}</dd>
          </dl>

          {panelNotice ? (
            <Alert variant="success" title="Fatto">
              {panelNotice}
            </Alert>
          ) : null}
          {panelError ? (
            <Alert variant="error" title="Non è stato possibile">
              {panelError}
            </Alert>
          ) : null}

          <TextField
            label="Titolo"
            value={draft.title}
            disabled={!canWrite || busy}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
          <TextField
            label="Testo alternativo"
            value={draft.altText}
            disabled={!canWrite || busy}
            helpText="Che cosa mostra l’immagine, per chi non la vede. Vuoto solo se è decorativa."
            onChange={(event) => setDraft({ ...draft, altText: event.target.value })}
          />
          <TextField
            label="Didascalia"
            value={draft.caption}
            disabled={!canWrite || busy}
            helpText="Compare sotto l’immagine, visibile a tutti."
            onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
          />
          <TextArea
            label="Descrizione"
            value={draft.description}
            disabled={!canWrite || busy}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />

          <div className="amoris-media-library__actions">
            <Button
              variant="primary"
              permitted={canWrite}
              loading={busy}
              onClick={() => void onSaveMetadata()}
            >
              Salva
            </Button>
            <Button
              variant="secondary"
              permitted={canWrite}
              disabled={busy}
              onClick={() => replaceInput.current?.click()}
            >
              Sostituisci il file
            </Button>
            <Button
              variant="destructive"
              permitted={canWrite}
              disabled={busy}
              onClick={() => {
                setDeleteError(null);
                setConfirming(true);
              }}
            >
              Elimina
            </Button>
          </div>

          <p id="media-replace-hint" className="amoris-media-library__note">
            {MEDIA_ALLOWED_HINT}
          </p>
          <p className="amoris-media-library__note">
            La sostituzione conserva l’indirizzo del file: le pagine che lo citano mostrano subito
            quello nuovo. Il file precedente viene sovrascritto e non si recupera.
          </p>

          <input
            ref={replaceInput}
            type="file"
            aria-label="Scegli il file che sostituisce questo"
            aria-describedby="media-replace-hint"
            className="amoris-media-library__file-input"
            accept={MEDIA_ACCEPT}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onReplacementChosen(file);
            }}
          />
        </SidePanel>
      ) : null}

      {selected && pendingReplacement ? (
        <Dialog open onClose={() => setPendingReplacement(null)} title="Sostituisci il file">
          <p>
            Il file attuale e le sue dimensioni derivate non si potranno recuperare: «
            {pendingReplacement.name}» prenderà il loro posto sullo stesso indirizzo.
          </p>
          <div className="amoris-media-library__actions">
            <Button variant="secondary" onClick={() => setPendingReplacement(null)}>
              Annulla
            </Button>
            <Button variant="primary" onClick={() => void onReplace(pendingReplacement)}>
              Sostituisci
            </Button>
          </div>
        </Dialog>
      ) : null}

      {selected ? (
        <ConfirmDestructive
          open={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={() => void onDelete()}
          title="Elimina il media"
          description="Il file esce dall’archivio e il suo indirizzo smette di rispondere. Se un contenuto lo cita, l’eliminazione viene rifiutata e il messaggio dice quali."
          objectName={selected.fileName}
          loading={busy}
          {...(deleteError ? { errorText: deleteError } : {})}
        />
      ) : null}
    </AreaShell>
  );
}
