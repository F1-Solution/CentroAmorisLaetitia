'use client';

import { Alert, Button, Dialog, RadioGroup, TextField } from '@amoris/ui';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';

type Method = 'password' | 'code';

const REFUSALS: Readonly<Record<string, string>> = {
  INVALID_CREDENTIALS: 'La password non è corretta.',
  INVALID_SECOND_FACTOR_CODE: 'Codice non corretto.',
  TOO_MANY_ATTEMPTS: 'Troppi tentativi. Riprova più tardi.',
};

/** Vero se l'API chiede una conferma recente prima di proseguire (DR-391, DR-396). */
export function isConfirmationRequired(caught: unknown): boolean {
  return caught instanceof ApiError && caught.code === 'CONFIRMATION_REQUIRED';
}

export interface ConfirmIdentityDialogProps {
  /** Conferma riuscita: chi apre la finestra ripete la richiesta rifiutata. */
  readonly onConfirmed: () => void;
  readonly onCancel: () => void;
}

/**
 * Conferma recente per la gestione degli account (DR-391, DR-396): la password oppure il codice
 * dell'app di autenticazione, mai entrambi, come chiede `POST /auth/confirm`.
 */
export function ConfirmIdentityDialog({
  onConfirmed,
  onCancel,
}: ConfirmIdentityDialogProps): React.JSX.Element {
  const [method, setMethod] = useState<Method>('password');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/confirm', {
        method: 'POST',
        body: method === 'password' ? { password: value } : { code: value.trim() },
      });
      onConfirmed();
    } catch (caught) {
      const refusal = caught instanceof ApiError ? REFUSALS[caught.code] : undefined;
      setError(
        refusal ??
          (caught instanceof ApiError
            ? caught.fullMessage
            : 'Non è stato possibile contattare il servizio.'),
      );
      setValue('');
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onCancel()}
      title="Conferma la tua identità"
      loading={busy}
    >
      <form onSubmit={onSubmit}>
        <p>
          La gestione degli account chiede una conferma recente: scrivi la tua password oppure il
          codice dell’app di autenticazione.
        </p>
        <RadioGroup
          legend="Conferma con"
          options={[
            { value: 'password', label: 'La password' },
            { value: 'code', label: 'Il codice dell’app' },
          ]}
          value={method}
          onChange={(next) => {
            setMethod(next as Method);
            setValue('');
            setError(null);
          }}
        />
        {method === 'password' ? (
          <TextField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={busy}
          />
        ) : (
          <TextField
            label="Codice di 6 cifre"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={busy}
          />
        )}
        {error ? (
          <Alert variant="error" title="Conferma non riuscita">
            {error}
          </Alert>
        ) : null}
        <div className="amoris-accounts__actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Annulla
          </Button>
          <Button type="submit" loading={busy}>
            Conferma
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
