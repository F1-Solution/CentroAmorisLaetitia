'use client';

import '../accesso/accesso.css';

import { Alert, Button, TextField } from '@amoris/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';

const MIN_LENGTH = 12;

/**
 * Cambio della propria password. È obbligatorio quando l'account è stato creato
 * o reimpostato (`mustChangePassword`): finché non è fatto l'API rifiuta ogni
 * altra rotta. Dopo il cambio l'API rinnova la sessione ma non la veste, quindi
 * si torna alla radice, che smista.
 */
export default function PasswordPage(): React.JSX.Element | null {
  const router = useRouter();
  const { user, loading, refresh, signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/accesso');
  }, [loading, user, router]);

  if (loading || !user) return null;

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    if (next.length < MIN_LENGTH) {
      setError(`La nuova password deve avere almeno ${MIN_LENGTH} caratteri.`);
      return;
    }
    if (next !== repeat) {
      setError('Le due nuove password non coincidono.');
      return;
    }
    if (next === current) {
      setError('La nuova password deve essere diversa da quella attuale.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      await refresh();
      router.replace('/');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'INVALID_CREDENTIALS') {
        setError('La password attuale non è corretta.');
      } else {
        setError(
          caught instanceof ApiError
            ? caught.fullMessage
            : 'Non è stato possibile contattare il servizio.',
        );
      }
      setBusy(false);
    }
  }

  return (
    <main className="amoris-access">
      <form className="amoris-access__card" onSubmit={onSubmit}>
        <h1 className="amoris-access__title">Cambia password</h1>
        <p className="amoris-access__lead">
          {user.mustChangePassword
            ? 'Prima di proseguire scegli una nuova password.'
            : 'Scegli una nuova password.'}
        </p>

        {error ? (
          <Alert variant="error" title="Password non cambiata">
            {error}
          </Alert>
        ) : null}

        <TextField
          label="Password attuale"
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          disabled={busy}
        />
        <TextField
          label="Nuova password"
          type="password"
          name="newPassword"
          autoComplete="new-password"
          required
          value={next}
          onChange={(event) => setNext(event.target.value)}
          disabled={busy}
        />
        <TextField
          label="Ripeti la nuova password"
          type="password"
          name="repeatPassword"
          autoComplete="new-password"
          required
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
          disabled={busy}
        />

        <Button type="submit" loading={busy}>
          Cambia password
        </Button>
        <Button
          type="button"
          variant="tertiary"
          disabled={busy}
          onClick={() => {
            void signOut().then(() => router.replace('/accesso'));
          }}
        >
          Esci
        </Button>
      </form>
    </main>
  );
}
