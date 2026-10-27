'use client';

import { Alert, Button, CheckboxField, Dialog } from '@amoris/ui';
import { useState } from 'react';
import { ROLE_OPTIONS } from './accountLabels';
import { CurrentPasswordField, useCurrentPassword } from './CurrentPasswordField';
import type { Account, AccountRoleKey } from './types';

interface ConfirmProps {
  readonly account: Account;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onClose: () => void;
}

export interface ConfirmAccountDialogProps extends ConfirmProps {
  readonly kind: 'deactivate' | 'reset';
  readonly onConfirm: () => void;
}

const COPY = {
  deactivate: {
    title: 'Disattiva l’account',
    action: 'Disattiva',
    text: (name: string) =>
      `${name} non potrà più entrare e le sue sessioni aperte si chiudono subito. L’account non viene cancellato e si può riattivare.`,
  },
  reset: {
    title: 'Reimposta la password',
    action: 'Reimposta',
    text: (name: string) =>
      `Per ${name} nasce una password temporanea, mostrata una sola volta; le sue sessioni si chiudono e al prossimo accesso dovrà sceglierne una nuova.`,
  },
} as const;

/** Conferma breve prima di disattivare o reimpostare: azioni che chiudono sessioni. */
export function ConfirmAccountDialog({
  kind,
  account,
  busy,
  error,
  onClose,
  onConfirm,
}: ConfirmAccountDialogProps): React.JSX.Element {
  const copy = COPY[kind];
  return (
    <Dialog open onClose={() => !busy && onClose()} title={copy.title} loading={busy}>
      <p>{copy.text(account.fullName)}</p>
      {error ? (
        <Alert variant="error" title="Non è stato possibile">
          {error}
        </Alert>
      ) : null}
      <div className="amoris-accounts__actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Annulla
        </Button>
        <Button
          variant={kind === 'deactivate' ? 'destructive' : 'primary'}
          onClick={onConfirm}
          loading={busy}
        >
          {copy.action}
        </Button>
      </div>
    </Dialog>
  );
}

export interface RolesDialogProps extends ConfirmProps {
  /** Vero sul proprio account: il salvataggio chiede la password attuale (DR-288). */
  readonly isSelf?: boolean;
  /** Rifiuto della password attuale da parte dell'API, mostrato sul campo. */
  readonly passwordError?: string | null;
  /** Quanti rifiuti della password: ognuno svuota il campo e gli rende il fuoco. */
  readonly passwordRefusals?: number;
  readonly onSave: (roleKeys: readonly AccountRoleKey[], currentPassword?: string) => void;
}

/** Scelta dei ruoli di un account esistente; almeno uno. */
export function RolesDialog({
  account,
  isSelf = false,
  busy,
  error,
  passwordError = null,
  passwordRefusals = 0,
  onClose,
  onSave,
}: RolesDialogProps): React.JSX.Element {
  const [roles, setRoles] = useState<readonly string[]>(account.roleKeys);
  const [localError, setLocalError] = useState<string | null>(null);
  const currentPassword = useCurrentPassword(passwordError, passwordRefusals);

  function save(): void {
    if (roles.length === 0) {
      setLocalError('Scegli almeno un ruolo.');
      return;
    }
    setLocalError(null);
    const chosen = ROLE_OPTIONS.map((role) => role.key).filter((key) => roles.includes(key));
    if (!isSelf) {
      onSave(chosen);
      return;
    }
    if (currentPassword.isMissing()) return;
    onSave(chosen, currentPassword.value);
  }

  const shown = localError ?? error;

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={`Ruoli di ${account.fullName}`}
      loading={busy}
    >
      {shown ? (
        <Alert variant="error" title="Ruoli non salvati">
          {shown}
        </Alert>
      ) : null}
      <fieldset className="amoris-accounts__roles">
        <legend>Ruoli</legend>
        {ROLE_OPTIONS.map((role) => (
          <CheckboxField
            key={role.key}
            label={role.label}
            checked={roles.includes(role.key)}
            disabled={busy}
            onChange={(event) =>
              setRoles((current) =>
                event.target.checked
                  ? [...current, role.key]
                  : current.filter((key) => key !== role.key),
              )
            }
          />
        ))}
      </fieldset>
      {isSelf ? <CurrentPasswordField state={currentPassword} disabled={busy} /> : null}
      <div className="amoris-accounts__actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Annulla
        </Button>
        <Button onClick={save} loading={busy}>
          Salva i ruoli
        </Button>
      </div>
    </Dialog>
  );
}
