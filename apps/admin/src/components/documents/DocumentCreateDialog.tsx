'use client';

import { Alert, Button, Dialog, SelectField, TextArea, TextField } from '@amoris/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { api } from '../../lib/api';
import { checkMediaFile } from '../../lib/mediaCheck';
import { uploadFile } from '../../lib/upload';
import { messageOf, type EditorialDocument } from './documentModel';
import './DocumentEditor.css';

/**
 * «Nuovo documento» (DR-281): il PDF passa da `POST /media`, con le regole e la pulizia dei
 * caricamenti, poi `POST /documents` crea il documento pubblico; se la creazione è rifiutata
 * il file appena caricato si toglie.
 */

const PDF_ACCEPT = 'application/pdf,.pdf';
const NOT_PDF = 'Il documento è un PDF: scegli un file PDF.';
const NO_TITLE = 'Il titolo è obbligatorio.';
const NO_FILE = 'Scegli il file PDF del documento.';
const NO_CATEGORY = 'Non ci sono categorie dei download: il documento non avrebbe dove comparire.';

interface DownloadCategory {
  readonly id: string;
  readonly name: string;
}

interface FormErrors {
  readonly title?: string;
  readonly file?: string;
  readonly general?: string;
}

export interface DocumentCreateDialogProps {
  readonly onClose: () => void;
}

export function DocumentCreateDialog({ onClose }: DocumentCreateDialogProps): React.JSX.Element {
  const router = useRouter();
  const fileId = useId();
  const [categories, setCategories] = useState<readonly DownloadCategory[] | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [termId, setTermId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const loaded = await api<DownloadCategory[]>('/terms?taxonomy=wpdmcategory', {
          signal: controller.signal,
        });
        setCategories(loaded);
        setTermId(loaded[0]?.id ?? '');
      } catch (caught) {
        if (!controller.signal.aborted) setErrors({ general: messageOf(caught) });
      }
    })();
    return () => controller.abort();
  }, []);

  function onFileChosen(chosen: File): void {
    const rejection = chosen.name.toLowerCase().endsWith('.pdf') ? checkMediaFile(chosen) : NOT_PDF;
    setFile(rejection ? null : chosen);
    setErrors((current) => ({
      ...(current.title ? { title: current.title } : {}),
      ...(current.general ? { general: current.general } : {}),
      ...(rejection ? { file: rejection } : {}),
    }));
  }

  /** Il controllo prima di ogni richiesta: titolo, file e categoria. */
  function localErrors(): FormErrors | null {
    const found: { title?: string; file?: string; general?: string } = {};
    if (!title.trim()) found.title = NO_TITLE;
    if (!file) found.file = errors.file ?? NO_FILE;
    if (!termId) found.general = NO_CATEGORY;
    return Object.keys(found).length > 0 ? found : null;
  }

  async function onCreate(): Promise<void> {
    const problems = localErrors();
    if (problems || !file) {
      setErrors(problems ?? {});
      return;
    }
    setBusy(true);
    setErrors({});
    let mediaId: string;
    try {
      mediaId = (await uploadFile<{ id: string }>('/media', file)).id;
    } catch (caught) {
      setErrors({ file: messageOf(caught) });
      setBusy(false);
      return;
    }
    try {
      const created = await api<EditorialDocument>('/documents', {
        method: 'POST',
        body: { title: title.trim(), description: description.trim(), termId, mediaId },
      });
      router.push(`/redazione/documenti/${created.id}?creato=1`);
    } catch (caught) {
      setErrors({ general: messageOf(caught) });
      // Il file caricato non resta orfano nella libreria; se anche questo fallisce resta lì.
      await api(`/media/${mediaId}`, { method: 'DELETE' }).catch(() => undefined);
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Nuovo documento" loading={busy}>
      <TextField
        label="Titolo"
        value={title}
        disabled={busy}
        {...(errors.title ? { errorText: errors.title } : {})}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="amoris-field">
        <label htmlFor={fileId} className="amoris-field__label">
          File PDF
        </label>
        <input
          id={fileId}
          type="file"
          accept={PDF_ACCEPT}
          disabled={busy}
          aria-invalid={errors.file ? true : undefined}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) onFileChosen(chosen);
          }}
        />
        {errors.file ? (
          <p className="amoris-field__error" role="alert">
            {errors.file}
          </p>
        ) : (
          <p className="amoris-field__help">
            Autore e programma che lo ha scritto si tolgono dal file al caricamento.
          </p>
        )}
      </div>
      <TextArea
        label="Descrizione"
        value={description}
        disabled={busy}
        helpText="Facoltativa, solo testo. Compare nella pagina del documento e nella ricerca."
        onChange={(event) => setDescription(event.target.value)}
      />
      <SelectField
        label="Categoria dei download"
        value={termId}
        disabled={busy || categories === null}
        options={(categories ?? []).map((category) => ({
          value: category.id,
          label: category.name,
        }))}
        emptyText={categories === null ? 'Caricamento delle categorie…' : NO_CATEGORY}
        helpText="Il documento compare nell’elenco di questa categoria sul sito."
        onChange={(event) => setTermId(event.target.value)}
      />
      {errors.general ? (
        <Alert variant="error" title="Il documento non è stato creato">
          {errors.general}
        </Alert>
      ) : null}
      <div className="amoris-document__actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Annulla
        </Button>
        <Button variant="primary" loading={busy} onClick={() => void onCreate()}>
          Crea il documento
        </Button>
      </div>
    </Dialog>
  );
}
