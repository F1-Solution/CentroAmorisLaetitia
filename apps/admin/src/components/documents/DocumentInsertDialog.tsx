'use client';

import { Alert, Button, Dialog, SelectField } from '@amoris/ui';
import { useState } from 'react';
import { usePublicDocuments } from './usePublicDocuments';

export interface DocumentInsertDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onInsert: (documentId: string) => void;
}

/** Passo «Quale documento?» dell'inserimento del blocco «Documento», solo fra i pubblici (DR-287). */
export function DocumentInsertDialog({
  open,
  onClose,
  onInsert,
}: DocumentInsertDialogProps): React.JSX.Element | null {
  const { documents, error } = usePublicDocuments(open);
  const [chosen, setChosen] = useState('');

  if (!open) return null;

  // Senza documenti nessuna voce, così il campo mostra il suo testo per l'elenco vuoto.
  const options =
    !documents || documents.length === 0
      ? []
      : [
          { value: '', label: 'Scegli un documento' },
          ...documents.map((document) => ({ value: document.id, label: document.title })),
        ];

  return (
    <Dialog open={open} onClose={onClose} title="Documento">
      {error ? (
        <Alert variant="error" title="I documenti non si sono caricati">
          {error}
        </Alert>
      ) : null}
      {documents === null && !error ? <p>Caricamento dei documenti in corso…</p> : null}
      {documents ? (
        <SelectField
          label="Quale documento?"
          emptyText="Non ci sono documenti pubblici."
          value={chosen}
          options={options}
          onChange={(event) => setChosen(event.target.value)}
        />
      ) : null}
      <Button variant="secondary" onClick={onClose}>
        Annulla
      </Button>
      <Button variant="primary" disabled={chosen === ''} onClick={() => onInsert(chosen)}>
        Inserisci
      </Button>
    </Dialog>
  );
}
