'use client';

import { DensityProvider } from '@amoris/ui';
import type { ReactNode } from 'react';
import { SessionProvider } from '../lib/session';

/**
 * I due contesti che ogni schermata presuppone.
 *
 * La densità è **comoda** di predefinito (DR-054, prestito 1) e l'interruttore
 * resta raggiungibile da ogni schermata: è la condizione che l'utente ha posto
 * accettando i tre prestiti. La preferenza non viene salvata nel browser di
 * proposito — `design-system.md` §5.2 punto 3 la vuole legata all'account, e
 * quell'API non esiste ancora: un ripiego sul browser sarebbe una scelta presa
 * di iniziativa.
 */
export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <DensityProvider>
      <SessionProvider>{children}</SessionProvider>
    </DensityProvider>
  );
}
