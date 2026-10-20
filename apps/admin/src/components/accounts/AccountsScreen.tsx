'use client';

import { Alert, Button, DataTable, PageHeader } from '@amoris/ui';
import type { DataTableColumn } from '@amoris/ui';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { AreaShell } from '../AreaShell';
import { ConfirmAccountDialog, RolesDialog } from './AccountDialogs';
import { accountErrorMessage, italianDate, roleLabel } from './accountLabels';
import { CreateAccountForm } from './CreateAccountForm';
import { TemporaryPasswordPanel } from './TemporaryPasswordPanel';
import type { Account, AccountRoleKey, CreateAccountBody } from './types';
import './Accounts.css';

type Pending = { kind: 'deactivate' | 'reset' | 'roles'; account: Account };
type Revealed = { personName: string; password: string };

/**
 * «Persone e permessi»: elenco, creazione, ruoli, disattivazione e
 * reimpostazione della password. I comandi di scrittura non compaiono senza
 * `users.manage`; l'API rifiuta comunque (DR-057).
 */
export function AccountsScreen(): React.JSX.Element {
  const { user } = useSession();
  const canManage = user?.permissions.includes('users.manage') ?? false;

  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  /** Esegue una scrittura: ferma gli invii doppi e porta l'errore in italiano. */
  async function run(task: () => Promise<void>): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await task();
    } catch (caught) {
      setActionError(accountErrorMessage(caught));
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
      setRevealed({ personName: result.account.fullName, password: result.temporaryPassword });
      await load();
    });

  const update = (account: Account, body: Record<string, unknown>): Promise<void> =>
    run(async () => {
      await api(`/accounts/${encodeURIComponent(account.id)}`, { method: 'PATCH', body });
      setPending(null);
      await load();
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
                    onClick={() => void update(row, { isActive: true })}
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

      {canManage && pending && pending.kind !== 'roles' ? (
        <ConfirmAccountDialog
          kind={pending.kind}
          account={pending.account}
          busy={busy}
          error={actionError}
          onClose={() => setPending(null)}
          onConfirm={() =>
            void (pending.kind === 'reset'
              ? reset(pending.account)
              : update(pending.account, { isActive: false }))
          }
        />
      ) : null}

      {canManage && pending?.kind === 'roles' ? (
        <RolesDialog
          account={pending.account}
          busy={busy}
          error={actionError}
          onClose={() => setPending(null)}
          onSave={(roleKeys: readonly AccountRoleKey[]) =>
            void update(pending.account, { roleKeys })
          }
        />
      ) : null}
    </AreaShell>
  );
}
