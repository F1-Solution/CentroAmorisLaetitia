'use client';

import { Alert, Button, DataTable, PageHeader } from '@amoris/ui';
import type { DataTableColumn } from '@amoris/ui';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  ACCESS_NOTICE_KEY,
  EMAIL_CHANGED_NOTICE,
  ROLES_CHANGED_NOTICE,
} from '../../lib/accessNotice';
import { useSession } from '../../lib/session';
import { AreaShell } from '../AreaShell';
import { ConfirmAccountDialog, RolesDialog } from './AccountDialogs';
import {
  accountErrorMessage,
  italianDate,
  passwordRefusalMessage,
  roleLabel,
} from './accountLabels';
import { CreateAccountForm } from './CreateAccountForm';
import { EditAccountDialog } from './EditAccountDialog';
import { TemporaryPasswordPanel } from './TemporaryPasswordPanel';
import type { Account, AccountRoleKey, CreateAccountBody, UpdateIdentityBody } from './types';
import './Accounts.css';

type Pending = { kind: 'deactivate' | 'reset' | 'roles' | 'identity'; account: Account };
type Revealed = { personName: string; password: string };

/** Lascia l'avviso alla schermata di accesso; senza memoria del browser l'avviso semplicemente non compare. */
function rememberAccessNotice(code: string): void {
  try {
    window.sessionStorage.setItem(ACCESS_NOTICE_KEY, code);
  } catch {
    // Memoria del browser non disponibile: l'accesso funziona lo stesso.
  }
}

/**
 * «Persone e permessi»: elenco, creazione, nome ed email (DR-282), ruoli,
 * disattivazione e reimpostazione della password. I comandi di scrittura non compaiono senza
 * `users.manage`; l'API rifiuta comunque (DR-057).
 */
export function AccountsScreen(): React.JSX.Element {
  const { user, refresh } = useSession();
  const canManage = user?.permissions.includes('users.manage') ?? false;

  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordRefusals, setPasswordRefusals] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: Account[] }>('/accounts');
      setAccounts(result.items);
      setError(null);
    } catch (caught) {
      setError(accountErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Esegue una scrittura: ferma gli invii doppi e porta l'errore in italiano; quello della password va sul suo campo. */
  async function run(task: () => Promise<void>): Promise<void> {
    setBusy(true);
    setActionError(null);
    setPasswordError(null);
    setNotice(null);
    try {
      await task();
    } catch (caught) {
      const refusal = passwordRefusalMessage(caught);
      if (refusal) {
        setPasswordError(refusal);
        setPasswordRefusals((count) => count + 1);
      } else setActionError(accountErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const create = (body: CreateAccountBody): Promise<void> =>
    run(async () => {
      const result = await api<{ account: Account; temporaryPassword: string }>('/accounts', {
        method: 'POST',
        body,
      });
      setCreating(false);
      setNotice('Account creato.');
      setRevealed({ personName: result.account.fullName, password: result.temporaryPassword });
      await load();
    });

  const update = (account: Account, body: Record<string, unknown>, done: string): Promise<void> =>
    run(async () => {
      await api(`/accounts/${encodeURIComponent(account.id)}`, { method: 'PATCH', body });
      setPending(null);
      setNotice(done);
      await load();
    });

  /** Togliersi un ruolo chiude la propria sessione: l'avviso lo mostra la schermata di accesso (W8-28). */
  const updateRoles = (
    account: Account,
    roleKeys: readonly AccountRoleKey[],
    currentPassword?: string,
  ): Promise<void> => {
    const body = currentPassword === undefined ? { roleKeys } : { roleKeys, currentPassword };
    const ownRoleRemoved =
      account.id === user?.userId &&
      account.roleKeys.some((key) => !roleKeys.includes(key as AccountRoleKey));
    if (!ownRoleRemoved) return update(account, body, 'Modifiche salvate.');
    return run(async () => {
      await api(`/accounts/${encodeURIComponent(account.id)}`, { method: 'PATCH', body });
      setPending(null);
      rememberAccessNotice(ROLES_CHANGED_NOTICE);
      // La sessione è chiusa: rileggerla porta all'accesso, rileggere l'elenco darebbe solo un 401.
      await refresh();
    });
  };

  /** Sul proprio account si rilegge la sessione: un indirizzo nuovo l'ha chiusa e l'area riporta all'accesso. */
  const updateIdentity = (
    account: Account,
    body: UpdateIdentityBody,
    currentPassword?: string,
  ): Promise<void> =>
    run(async () => {
      await api(`/accounts/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        body: currentPassword === undefined ? body : { ...body, currentPassword },
      });
      setPending(null);
      const ownEmail = account.id === user?.userId && body.email !== undefined;
      // Il proprio indirizzo nuovo chiude la sessione: l'avviso lo mostra la schermata di accesso.
      if (ownEmail) rememberAccessNotice(EMAIL_CHANGED_NOTICE);
      else setNotice('Modifiche salvate.');
      if (account.id === user?.userId) await refresh();
      // Con un indirizzo proprio nuovo la sessione è chiusa: rileggere l'elenco darebbe solo un 401.
      if (account.id !== user?.userId || body.email === undefined) await load();
    });

  const reset = (account: Account): Promise<void> =>
    run(async () => {
      const result = await api<{ temporaryPassword: string }>(
        `/accounts/${encodeURIComponent(account.id)}/password-reset`,
        { method: 'POST' },
      );
      setPending(null);
      setRevealed({ personName: account.fullName, password: result.temporaryPassword });
    });

  function openPending(next: Pending): void {
    setActionError(null);
    setPasswordError(null);
    setPending(next);
  }

  const columns: DataTableColumn<Account>[] = [
    {
      key: 'name',
      header: 'Nome',
      render: (row) => (
        <>
          <strong>{row.fullName}</strong>
          <br />
          <span>{row.email}</span>
        </>
      ),
    },
    {
      key: 'roles',
      header: 'Ruoli',
      render: (row) => row.roleKeys.map(roleLabel).join(', '),
    },
    { key: 'status', header: 'Stato', render: (row) => (row.isActive ? 'Attivo' : 'Disattivato') },
    {
      key: 'lastLogin',
      header: 'Ultimo accesso',
      render: (row) => (row.lastLoginAt ? italianDate(row.lastLoginAt) : 'Mai'),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Azioni',
            render: (row: Account) => (
              <div className="amoris-accounts__row-actions">
                <Button
                  variant="tertiary"
                  aria-label={`Modifica nome ed email di ${row.fullName}`}
                  onClick={() => openPending({ kind: 'identity', account: row })}
                >
                  Modifica
                </Button>
                <Button
                  variant="tertiary"
                  aria-label={`Modifica i ruoli di ${row.fullName}`}
                  onClick={() => openPending({ kind: 'roles', account: row })}
                >
                  Ruoli
                </Button>
                {row.isActive ? (
                  row.id === user?.userId ? null : (
                    <Button
                      variant="tertiary"
                      aria-label={`Disattiva ${row.fullName}`}
                      onClick={() => openPending({ kind: 'deactivate', account: row })}
                    >
                      Disattiva
                    </Button>
                  )
                ) : (
                  <Button
                    variant="tertiary"
                    aria-label={`Riattiva ${row.fullName}`}
                    disabled={busy}
                    onClick={() => void update(row, { isActive: true }, 'Account riattivato.')}
                  >
                    Riattiva
                  </Button>
                )}
                {row.id === user?.userId ? null : (
                  <Button
                    variant="tertiary"
                    aria-label={`Reimposta la password di ${row.fullName}`}
                    onClick={() => openPending({ kind: 'reset', account: row })}
                  >
                    Reimposta password
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <AreaShell
      area="impostazioni"
      sectionId="persone"
      breadcrumbs={[
        { label: 'Impostazioni', href: '/impostazioni' },
        { label: 'Persone e permessi' },
      ]}
    >
      <PageHeader
        title="Persone e permessi"
        summary="Chi può entrare nell’area amministrativa e con quale ruolo."
        loading={loading}
        action={
          <Button permitted={canManage && !creating} onClick={() => setCreating(true)}>
            Nuova persona
          </Button>
        }
      />

      {error ? (
        <Alert variant="error" title="Non è stato possibile">
          {error}
        </Alert>
      ) : null}

      {notice ? (
        <Alert variant="success" title="Fatto">
          {notice}
        </Alert>
      ) : null}

      {revealed ? (
        <TemporaryPasswordPanel
          personName={revealed.personName}
          password={revealed.password}
          onDismiss={() => setRevealed(null)}
        />
      ) : null}

      {canManage && creating ? (
        <CreateAccountForm
          busy={busy}
          error={actionError}
          onSubmit={(body) => void create(body)}
          onCancel={() => {
            setCreating(false);
            setActionError(null);
          }}
        />
      ) : null}

      {actionError && !creating && !pending ? (
        <div className="amoris-accounts__error">
          <Alert variant="error" title="Operazione non riuscita">
            {actionError}
          </Alert>
        </div>
      ) : null}

      {!error ? (
        <DataTable
          caption="Persone con accesso all’area amministrativa"
          columns={columns}
          rows={[...accounts]}
          getRowId={(row) => row.id}
          loading={loading}
          emptyText="Nessuna persona."
        />
      ) : null}

      {canManage && (pending?.kind === 'deactivate' || pending?.kind === 'reset') ? (
        <ConfirmAccountDialog
          kind={pending.kind}
          account={pending.account}
          busy={busy}
          error={actionError}
          onClose={() => setPending(null)}
          onConfirm={() =>
            void (pending.kind === 'reset'
              ? reset(pending.account)
              : update(pending.account, { isActive: false }, 'Account disattivato.'))
          }
        />
      ) : null}

      {canManage && pending?.kind === 'identity' ? (
        <EditAccountDialog
          account={pending.account}
          isSelf={pending.account.id === user?.userId}
          busy={busy}
          error={actionError}
          passwordError={passwordError}
          passwordRefusals={passwordRefusals}
          onClose={() => setPending(null)}
          onSave={(body, currentPassword) =>
            void updateIdentity(pending.account, body, currentPassword)
          }
        />
      ) : null}

      {canManage && pending?.kind === 'roles' ? (
        <RolesDialog
          account={pending.account}
          isSelf={pending.account.id === user?.userId}
          busy={busy}
          error={actionError}
          passwordError={passwordError}
          passwordRefusals={passwordRefusals}
          onClose={() => setPending(null)}
          onSave={(roleKeys: readonly AccountRoleKey[], currentPassword?: string) =>
            void updateRoles(pending.account, roleKeys, currentPassword)
          }
        />
      ) : null}
    </AreaShell>
  );
}
