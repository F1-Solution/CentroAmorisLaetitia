import { useEffect, useState } from 'react';
import { Dialog } from '../layout/Dialog';
import { TextField } from './TextField';
import { Button } from './Button';
import './ConfirmDestructive.css';

export interface ConfirmDestructiveProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Frase che spiega la conseguenza, in italiano corrente, non solo «sei sicuro?». */
  description: string;
  /** Nome dell'oggetto da digitare per sbloccare la conferma. */
  objectName: string;
  loading?: boolean;
  errorText?: string;
  confirmLabel?: string;
}

/**
 * Componente 34: conferma di eliminazione definitiva con digitazione del nome
 * dell'oggetto. Rende difficile l'errore — il bottone di conferma resta
 * disabilitato finché il testo digitato non corrisponde esattamente — non solo
 * chiede «sei sicuro?» (CLAUDE.md, cancellazioni fra le azioni a conferma
 * obbligatoria).
 */
export function ConfirmDestructive({
  open,
  onClose,
  onConfirm,
  title,
  description,
  objectName,
  loading = false,
  errorText,
  confirmLabel = 'Elimina definitivamente',
}: ConfirmDestructiveProps): React.JSX.Element | null {
  const [typed, setTyped] = useState('');

  // Il testo digitato si azzera quando la finestra si riapre, così una
  // conferma precedente non resta valida per un altro oggetto.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  if (!open) return null;

  const matches = typed === objectName;

  return (
    <Dialog open={open} onClose={onClose} title={title} loading={loading}>
      <p className="amoris-confirm-destructive__description">{description}</p>
      <TextField
        label={`Digita «${objectName}» per confermare`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        disabled={loading}
        {...(errorText !== undefined ? { errorText } : {})}
        autoComplete="off"
      />
      <div className="amoris-confirm-destructive__actions">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Annulla
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={!matches || loading} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
