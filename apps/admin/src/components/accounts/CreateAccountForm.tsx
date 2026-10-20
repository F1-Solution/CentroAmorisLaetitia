'use client';

import { Alert, Button, CheckboxField, TextField } from '@amoris/ui';
import type { AccountRoleKey, CreateAccountBody } from './types';
import { useState } from 'react';
import { ROLE_OPTIONS } from './accountLabels';

export interface CreateAccountFormProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSubmit: (body: CreateAccountBody) => void;
  readonly onCancel: () => void;
}

/** Modulo di creazione: nome, indirizzo e almeno un ruolo. */
export function CreateAccountForm({
  busy,
  error,
  onSubmit,
  onCancel,
}: CreateAccountFormProps): React.JSX.Element {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<readonly AccountRoleKey[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  function toggle(key: AccountRoleKey, checked: boolean): void {
    setRoles((current) => (checked ? [...current, key] : current.filter((role) => role !== key)));
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (roles.length === 0) {
      setLocalError('Scegli almeno un ruolo.');
      return;
    }
    setLocalError(null);
    onSubmit({
      email: email.trim(),
      fullName: fullName.trim(),
      roleKeys: ROLE_OPTIONS.map((role) => role.key).filter((key) => roles.includes(key)),
    });
  }

  const shown = localError ?? error;

  return (
    <form className="amoris-accounts__form" onSubmit={submit}>
      <h2 className="amoris-accounts__form-title">Nuova persona</h2>
      {shown ? (
        <Alert variant="error" title="Account non creato">
          {shown}
        </Alert>
      ) : null}
      <TextField
        label="Nome e cognome"
        name="fullName"
        required
        value={fullName}
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
        onChange={(event) => setEmail(event.target.value)}
        disabled={busy}
      />
      <fieldset className="amoris-accounts__roles">
        <legend>Ruoli</legend>
        {ROLE_OPTIONS.map((role) => (
          <CheckboxField
            key={role.key}
            label={role.label}
            checked={roles.includes(role.key)}
            disabled={busy}
            onChange={(event) => toggle(role.key, event.target.checked)}
          />
        ))}
      </fieldset>
      <div className="amoris-accounts__actions">
        <Button type="submit" loading={busy}>
          Crea account
        </Button>
        <Button variant="tertiary" onClick={onCancel} disabled={busy}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
