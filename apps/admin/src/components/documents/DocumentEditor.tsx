'use client';

import { Alert, Button, Dialog, PageHeader, TextArea, TextField } from '@amoris/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { checkMediaFile } from '../../lib/mediaCheck';
import { siteUrl } from '../../lib/siteUrl';
import { uploadFile } from '../../lib/upload';
import { useSession } from '../../lib/session';
import { AreaShell } from '../AreaShell';
import { humanSize } from '../media/MediaLibrary';
import { DocumentDeleteAction } from './DocumentDeleteAction';
import { lastUpdate, messageOf, takeArrivalFlag, type EditorialDocument } from './documentModel';
import './DocumentEditor.css';

const NOT_FOUND = 'Il documento non esiste o non è più pubblico.';
const PDF_ACCEPT = 'application/pdf,.pdf';
const NOT_PDF = 'Questo documento è un PDF: scegli un file PDF.';

interface FieldErrors {
  readonly title?: string;
  readonly description?: string;
  readonly general?: string;
}

/** Smista i campi rifiutati dall'API sul campo che li riguarda; il resto è un messaggio generale. */
function fieldErrorsFrom(caught: unknown): FieldErrors {
  if (!(caught instanceof ApiError) || caught.details.length === 0) {
    return { general: messageOf(caught) };
  }
  const errors: { title?: string; description?: string; general?: string } = {};
  for (const detail of caught.details) {
    const field = detail.path.replace(/^\//, '').split('.')[0];
    if (field === 'title' && !errors.title) errors.title = detail.message;
    else if (field === 'description' && !errors.description) errors.description = detail.message;
    else errors.general = errors.general ? `${errors.general} ${detail.message}` : detail.message;
  }
  return errors;
}

/** Scheda di un documento: titolo e descrizione si salvano, il file si sostituisce con la rotta dei media. */
export function DocumentEditor({ documentId }: { readonly documentId: string }): React.JSX.Element {
  const { user } = useSession();
  const canWrite = user?.permissions.includes('content.write') ?? false;
  // La sostituzione passa da `PUT /media/:id/file`, che chiede `media.write`.
  const canReplace = user?.permissions.includes('media.write') ?? false;
  // DR-281: l'eliminazione toglie anche il file e ritira il documento (DR-242).
  const canDelete =
    canWrite && canReplace && (user?.permissions.includes('content.publish') ?? false);

  const [document, setDocument] = useState<EditorialDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState<File | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  // Dopo «Crea il documento» si arriva qui con l'indicatore, letto una volta sola.
  useEffect(() => {
    if (takeArrivalFlag('creato')) setNotice('Documento creato.');
  }, []);

  const fill = useCallback((loaded: EditorialDocument): void => {
    setDocument(loaded);
    setTitle(loaded.title);
    setDescription(loaded.description ?? '');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        fill(
          await api<EditorialDocument>(`/documents/${documentId}`, { signal: controller.signal }),
        );
        setLoadError(null);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof ApiError && caught.status === 404 ? NOT_FOUND : messageOf(caught),
        );
      }
    })();
    return () => controller.abort();
  }, [documentId, fill]);

  const titleChanged = document !== null && title.trim() !== document.title;
  const descriptionChanged =
    document !== null && description.trim() !== (document.description ?? '');

  async function onSave(): Promise<void> {
    if (!document) return;
    setBusy(true);
    setErrors({});
    setNotice(null);
    try {
      const updated = await api<EditorialDocument>(`/documents/${document.id}`, {
        method: 'PATCH',
        body: {
          ...(titleChanged ? { title: title.trim() } : {}),
          ...(descriptionChanged ? { description: description.trim() } : {}),
        },
      });
      fill(updated);
      setNotice('Modifiche salvate.');
    } catch (caught) {
      setErrors(fieldErrorsFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  /** Controlla il file scelto e, se è ammesso, chiede conferma prima di sostituire. */
  function onReplacementChosen(file: File): void {
    setNotice(null);
    const isPdfDocument = document?.file.mimeType === 'application/pdf';
    const rejection =
      isPdfDocument && !file.name.toLowerCase().endsWith('.pdf') ? NOT_PDF : checkMediaFile(file);
    if (rejection) {
      setFileError(rejection);
      return;
    }
    setFileError(null);
    setPendingReplacement(file);
  }

  async function onReplace(file: File): Promise<void> {
    if (!document) return;
    setPendingReplacement(null);
    setBusy(true);
    setFileError(null);
    setNotice(null);
    try {
      await uploadFile(`/media/${document.file.mediaId}/file`, file, { method: 'PUT' });
      const reloaded = await api<EditorialDocument>(`/documents/${document.id}`);
      setDocument(reloaded);
      setNotice('File sostituito. Il collegamento «Download» del sito scarica il file nuovo.');
    } catch (caught) {
      setFileError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AreaShell
      area="redazione"
      sectionId="documenti"
      breadcrumbs={[
        { label: 'Redazione', href: '/redazione/pagine' },
        { label: 'Documenti', href: '/redazione/documenti' },
        { label: document?.title ?? 'Documento' },
      ]}
    >
      {loadError ? (
        <Alert variant="error" title="Non è stato possibile">
          {loadError}
        </Alert>
      ) : null}

      {document ? (
        <>
          <PageHeader title={document.title} summary="Titolo, descrizione e file del documento." />

          <dl className="amoris-document__facts">
            <dt>File</dt>
            <dd>
              {document.file.fileName} ({humanSize(document.file.byteSize)})
            </dd>
            <dt>Ultimo aggiornamento</dt>
            <dd>{lastUpdate(document)}</dd>
            <dt>Pagina sul sito</dt>
            <dd>
              <a href={siteUrl(document.sitePath)} target="_blank" rel="noopener noreferrer">
                Apri sul sito
              </a>
            </dd>
          </dl>

          {notice ? (
            <Alert variant="success" title="Fatto">
              {notice}
            </Alert>
          ) : null}
          {errors.general ? (
            <Alert variant="error" title="Non è stato salvato">
              {errors.general}
            </Alert>
          ) : null}

          <TextField
            label="Titolo"
            value={title}
            disabled={!canWrite || busy}
            {...(errors.title ? { errorText: errors.title } : {})}
            onChange={(event) => setTitle(event.target.value)}
          />
          <TextArea
            label="Descrizione"
            value={description}
            disabled={!canWrite || busy}
            helpText="Solo testo. Compare nella pagina del documento e nella ricerca."
            {...(errors.description ? { errorText: errors.description } : {})}
            onChange={(event) => setDescription(event.target.value)}
          />

          {canWrite || canReplace ? (
            <div className="amoris-document__actions">
              <Button
                variant="primary"
                permitted={canWrite}
                loading={busy}
                disabled={!titleChanged && !descriptionChanged}
                onClick={() => void onSave()}
              >
                Salva
              </Button>
              <Button
                variant="secondary"
                permitted={canReplace}
                disabled={busy}
                onClick={() => replaceInput.current?.click()}
              >
                Sostituisci il file
              </Button>
              {canDelete ? (
                <DocumentDeleteAction documentId={document.id} title={document.title} />
              ) : null}
            </div>
          ) : null}

          {fileError ? (
            <Alert variant="error" title="Non è stato possibile">
              {fileError}
            </Alert>
          ) : null}

          <p className="amoris-document__note">
            La sostituzione conserva l’indirizzo del file: il collegamento «Download» del sito
            scarica subito quello nuovo. Il file precedente viene sovrascritto e non si recupera.
          </p>

          {canReplace ? (
            <input
              ref={replaceInput}
              type="file"
              aria-label="Scegli il file che sostituisce questo"
              className="amoris-document__file-input"
              {...(document.file.mimeType === 'application/pdf' ? { accept: PDF_ACCEPT } : {})}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) onReplacementChosen(file);
              }}
            />
          ) : null}
        </>
      ) : null}

      {document && pendingReplacement ? (
        <Dialog open onClose={() => setPendingReplacement(null)} title="Sostituisci il file">
          <p>
            Il file attuale non si potrà recuperare: «{pendingReplacement.name}» prenderà il suo
            posto sullo stesso indirizzo.
          </p>
          <div className="amoris-document__actions">
            <Button variant="secondary" onClick={() => setPendingReplacement(null)}>
              Annulla
            </Button>
            <Button variant="primary" onClick={() => void onReplace(pendingReplacement)}>
              Sostituisci
            </Button>
          </div>
        </Dialog>
      ) : null}
    </AreaShell>
  );
}
