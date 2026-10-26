'use client';

import { Alert, Button, Dialog, SelectField } from '@amoris/ui';
import { useState } from 'react';
import { useSliders } from './useSliders';

export interface SliderInsertDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onInsert: (sliderId: string) => void;
}

/** Passo «Quale carosello?» dell'inserimento del blocco «Presentazione a scorrimento». */
export function SliderInsertDialog({
  open,
  onClose,
  onInsert,
}: SliderInsertDialogProps): React.JSX.Element | null {
  const { sliders, error } = useSliders(open);
  const [chosen, setChosen] = useState('');

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Presentazione a scorrimento">
      {error ? (
        <Alert variant="error" title="I caroselli non si sono caricati">
          {error}
        </Alert>
      ) : null}
      {sliders === null && !error ? <p>Caricamento dei caroselli in corso…</p> : null}
      {sliders ? (
        <SelectField
          label="Quale carosello?"
          emptyText="Non ci sono caroselli."
          value={chosen}
          options={[
            { value: '', label: 'Scegli un carosello' },
            ...sliders.map((slider) => ({ value: slider.id, label: slider.title })),
          ]}
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
