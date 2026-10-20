'use client';

import '../accesso/accesso.css';

import { Alert, AreaChoiceScreen } from '@amoris/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { AREA_DEFINITIONS } from '../../lib/areas';
import { useSession, vestmentsOf, type Vestment } from '../../lib/session';

/**
 * Scelta della veste. `ux-proposals.md` §4.3: **chi ne possiede una sola non
 * vede mai questa schermata**, entra direttamente — per quelle persone il
 * concetto di veste non esiste proprio, e mostrargliela lo inventerebbe.
 *
 * In Fase 1 esiste un solo ruolo, `editor` (ADR-007 §3.2), ma due aree: le
 * vesti sono quindi due, e la schermata si mostra davvero. Questo corregge
 * `design-system.md` §8.4, che si aspettava un commutatore quasi invisibile:
 * lo si aspettava contando i ruoli, mentre la fonte approvata conta le aree.
 */
export default function SceltaAreaPage(): React.JSX.Element | null {
  const router = useRouter();
  const { user, loading, chooseVestment } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoChosen = useRef(false);

  const vestments = vestmentsOf(user);
  const only = useMemo(() => {
    const owned = vestmentsOf(user);
    return owned.length === 1 ? owned[0] : undefined;
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/accesso');
      return;
    }
    if (user.mustChangePassword) {
      router.replace('/password');
      return;
    }
    if (only && user.activeArea) {
      router.replace(AREA_DEFINITIONS[user.activeArea].href);
      return;
    }
    // Dopo il cambio obbligatorio della password la sessione rinnovata non ha
    // veste: con una sola possibile la si indossa, senza mostrare una scelta.
    if (only && !autoChosen.current) {
      autoChosen.current = true;
      void chooseVestment(only)
        .then(() => router.replace(AREA_DEFINITIONS[only.area].href))
        .catch(() => setError('Non è stato possibile contattare il servizio.'));
    }
  }, [loading, user, only, chooseVestment, router]);

  if (loading || !user) return null;

  async function onChoose(id: string): Promise<void> {
    const vestment = vestments.find((entry: Vestment) => entry.id === id);
    if (!vestment) return;
    setBusy(true);
    setError(null);
    try {
      await chooseVestment(vestment);
      router.replace(AREA_DEFINITIONS[vestment.area].href);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.fullMessage
          : 'Non è stato possibile contattare il servizio.',
      );
      setBusy(false);
    }
  }

  return (
    <main className="amoris-choice">
      <p className="amoris-choice__greeting">Buon lavoro, {user.fullName}.</p>
      <AreaChoiceScreen
        areas={vestments.map((vestment) => ({
          id: vestment.id,
          label: AREA_DEFINITIONS[vestment.area].label,
          icon: AREA_DEFINITIONS[vestment.area].icon,
          href: AREA_DEFINITIONS[vestment.area].href,
        }))}
        onChoose={(id) => void onChoose(id)}
        loading={busy}
        {...(error ? { errorText: error } : {})}
      />
      {/* Con una sola area la schermata di scelta non si disegna: l'errore va detto qui. */}
      {error && vestments.length === 1 ? (
        <Alert variant="error" title="Non è stato possibile entrare">
          {error}
        </Alert>
      ) : null}
    </main>
  );
}
