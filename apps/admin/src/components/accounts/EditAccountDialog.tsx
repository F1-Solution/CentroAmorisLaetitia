'use client';

import { Alert, Button, Dialog, TextField } from '@amoris/ui';
import { useState } from 'react';
import { CurrentPasswordField, useCurrentPassword } from './CurrentPasswordField';
import type { Account, UpdateIdentityBody } from './types';

export interface EditAccountDialogProps {
  readonly account: Account;
  /** Vero quando l'account è quello di chi sta lavorando: l'avviso parla di questa sessione. */
  readonly isSelf: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  /** Rifiuto della password attuale da parte dell'API, mostrato sul campo (DR-288). */
  readonly passwordError?: string | null;
  /** Quanti rifiuti della password: ognuno svuota il campo e gli rende il fuoco. */
  readonly passwordRefusals?: number;
  readonly onClose: () => void;
  /** Riceve solo i campi cambiati, e sul proprio account la password attuale; non è chiamata se non cambia nulla. */
  readonly onSave: (body: UpdateIdentityBody, currentPassword?: string) => void;
}

/** La stessa espressione di `z.email()` (Zod 4), che l'API applica: solo ASCII. */
const EMAIL_SHAPE =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

/** Modifica di nome ed email di un account (DR-282); un indirizzo nuovo chiude le sessioni. */
export function EditAccountDialog({
  account,
  isSelf,
  busy,
  error,
  passwordError = null,
  passwordRefusals = 0,
  onClose,
  onSave,
}: EditAccountDialogProps): React.JSX.Element {
  const currentPassword = useCurrentPassword(passwordError, passwordRefusals);
  const [fullName, setFullName] = useState(account.fullName);
  const [email, setEmail] = useState(account.email);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const nextName = fullName.trim();
  const nextEmail = email.trim().toLowerCase();
  const emailChanged = nextEmail !== account.email.toLowerCase();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const badName = nextName.length === 0 ? 'Scrivi il nome e cognome.' : null;
    const badEmail = EMAIL_SHAPE.test(nextEmail) ? null : 'Scrivi un indirizzo email valido.';
    setNameError(badName);
    setEmailError(badEmail);
    if (badName || badEmail) return;
    const body: UpdateIdentityBody = {
      ...(nextName !== account.fullName ? { fullName: nextName } : {}),
      ...(emailChanged ? { email: nextEmail } : {}),
    };
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    if (!isSelf) {
      onSave(body);
      return;
    }
    if (currentPassword.isMissing()) return;
    onSave(body, currentPassword.value);
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={`Modifica ${account.fullName}`}
      loading={busy}
    >
      <form className="amoris-accounts__edit" onSubmit={submit} noValidate>
        {error ? (
          <Alert variant="error" title="Modifiche non salvate">
            {error}
          </Alert>
        ) : null}
        <TextField
          label="Nome e cognome"
          name="fullName"
          required
          value={fullName}
          {...(nameError ? { errorText: nameError } : {})}
          onChange={(event) => setFullName(event.target.value)}
          disabled={busy}
        />
        <TextField
          label="Indirizzo email"
          name="email"
          type="email"
          autoComplete="off"
          required
          value={email}
          {...(emailError ? { errorText: emailError } : {})}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
        />
        {emailChanged ? (
          <p className="amoris-accounts__notice">
            {isSelf
              ? `Cambiando il tuo indirizzo si chiude anche questa sessione: dovrai entrare di nuovo con ${nextEmail}.`
              : `Cambiando l’indirizzo si chiudono tutte le sessioni aperte di ${account.fullName}: dovrà entrare di nuovo con l’indirizzo nuovo.`}
          </p>
        ) : null}
        {isSelf ? <CurrentPasswordField state={currentPassword} disabled={busy} /> : null}
        <div className="amoris-accounts__actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annulla
          </Button>
          <Button type="submit" loading={busy}>
            Salva
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
