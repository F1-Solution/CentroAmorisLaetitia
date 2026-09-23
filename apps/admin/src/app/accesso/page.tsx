'use client';

import './accesso.css';

import { Alert, Button, TextField } from '@amoris/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { AREA_DEFINITIONS } from '../../lib/areas';
import { useSession, vestmentsOf } from '../../lib/session';

/**
 * Accesso. ADR-007 §3.1 controllo 9: il messaggio di errore è **uno solo** per
 * indirizzo inesistente e password errata, e qui non se ne aggiungono di più
 * precisi — sarebbe l'enumerazione degli account, reintrodotta dall'interfaccia
 * dopo che il servizio l'ha esclusa.
 *
 * Il recupero password non c'è, ed è voluto: ADR-007 §3.1 controllo 11 lo
 * dichiara fuori perimetro in Fase 1. Un collegamento «password dimenticata»
 * che non porta da nessuna parte sarebbe peggio della sua assenza.
 */
export default function AccessoPage(): React.JSX.Element {
  const router = useRouter();
  const { user, loading, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Chi ha già una sessione non vede la schermata di accesso.
  useEffect(() => {
    if (loading || !user) return;
    router.replace(user.activeArea ? AREA_DEFINITIONS[user.activeArea].href : '/scelta-area');
  }, [loading, user, router]);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await signIn(email, password);
      // Chi possiede una sola veste non incontra la domanda: entra e basta
      // (`ux-proposals.md` §4.3). Il servizio ha già scelto per lui.
      const only = vestmentsOf(next).length === 1 && next.activeArea;
      router.replace(only ? AREA_DEFINITIONS[next.activeArea!].href : '/scelta-area');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.fullMessage : 'Non è stato possibile contattare il servizio.',
      );
      setBusy(false);
    }
  }

  return (
    <main className="amoris-access">
      <form className="amoris-access__card" onSubmit={onSubmit}>
        <h1 className="amoris-access__title">Area di gestione</h1>
        <p className="amoris-access__lead">Centro per la Famiglia Amoris Laetitia</p>

        {error ? (
          <Alert variant="error" title="Accesso non riuscito">
            {error}
          </Alert>
        ) : null}

        <TextField
          label="Indirizzo di posta"
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
        />

        <Button type="submit" loading={busy}>
          Entra
        </Button>
      </form>
    </main>
  );
}
