'use client';

import '../accesso/accesso.css';

import { Alert, Button, TextField } from '@amoris/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { secondFactorPending, useSession } from '../../lib/session';

interface Enrollment {
  readonly secret: string;
  readonly otpauthUri: string;
}

/** La chiave in gruppi di quattro caratteri, più facile da copiare a mano nell'app. */
function grouped(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.fullMessage
    : 'Non è stato possibile contattare il servizio.';
}

/**
 * Secondo fattore (DR-384): dopo la password, e prima di ogni altra cosa, l'attivazione al primo
 * accesso o il codice di 6 cifre agli accessi seguenti. La chiave si mostra solo su richiesta e
 * solo durante l'attivazione; la reimpostazione è del manutentore, da riga di comando (DR-397).
 */
export default function SecondoFattorePage(): React.JSX.Element | null {
  const router = useRouter();
  const { user, loading, refresh, signOut } = useSession();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/accesso');
    else if (!secondFactorPending(user)) router.replace('/');
  }, [loading, user, router]);

  if (loading || !user || !secondFactorPending(user)) return null;
  const activating = user.secondFactor === 'activation_required';

  async function showKey(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setEnrollment(await api<Enrollment>('/auth/second-factor/setup', { method: 'POST' }));
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(activating ? '/auth/second-factor/activate' : '/auth/second-factor/verify', {
        method: 'POST',
        body: { code: code.trim() },
      });
      await refresh();
      // La radice smista: cambio della password se dovuto, poi l'area.
      router.replace('/');
    } catch (caught) {
      setError(messageOf(caught));
      setCode('');
      setBusy(false);
    }
  }

  const codeForm = (
    <>
      <TextField
        label="Codice di 6 cifre"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(event) => setCode(event.target.value)}
        disabled={busy}
      />
      <Button type="submit" loading={busy}>
        {activating ? 'Attiva' : 'Verifica'}
      </Button>
    </>
  );

  return (
    <main className="amoris-access">
      <form className="amoris-access__card" onSubmit={onSubmit}>
        <h1 className="amoris-access__title">Secondo fattore</h1>
        <p className="amoris-access__lead">
          {activating
            ? 'Prima di proseguire attiva il secondo fattore: a ogni accesso, oltre alla password, servirà il codice di 6 cifre dell’app di autenticazione del tuo telefono.'
            : 'Scrivi il codice di 6 cifre che l’app di autenticazione mostra ora.'}
        </p>

        {error ? (
          <Alert variant="error" title="Non è stato possibile proseguire">
            {error}
          </Alert>
        ) : null}

        {activating && !enrollment ? (
          <Button type="button" onClick={() => void showKey()} loading={busy}>
            Mostra la chiave
          </Button>
        ) : null}

        {activating && enrollment ? (
          <>
            <p className="amoris-access__lead">
              Nell’app di autenticazione aggiungi un account con questa chiave, poi scrivi qui il
              codice che compare. La chiave non verrà mostrata di nuovo.
            </p>
            <code className="amoris-access__key" aria-label="Chiave da inserire nell’app">
              {grouped(enrollment.secret)}
            </code>
            <a href={enrollment.otpauthUri}>Apri nell’app di autenticazione</a>
            {codeForm}
          </>
        ) : null}

        {activating ? null : codeForm}

        <p className="amoris-access__lead">
          Hai perso il telefono? Esci e chiedi al manutentore di reimpostare il secondo fattore.
        </p>
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
