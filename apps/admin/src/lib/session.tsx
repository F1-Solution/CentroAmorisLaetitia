'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from './api';
import type { AreaId } from './areas';

/**
 * La sessione come la vede l'interfaccia.
 *
 * Non è uno specchio dell'account: è la **veste in corso**. Il ruolo attivo e
 * l'area attiva arrivano dal servizio e non si scelgono qui — il client può
 * chiedere di cambiarli, ma è l'API a decidere se quella veste è posseduta, e i
 * permessi che tornano sono quelli del ruolo attivo (DR-067).
 *
 * Di conseguenza `permissions` è **vuoto finché la veste non è scelta**, e non
 * è un caso limite da aggirare: è la schermata di scelta, e null'altro è
 * raggiungibile.
 */

export interface RoleHeld {
  readonly roleId: string;
  readonly key: string;
  readonly label: string;
  readonly areas: readonly AreaId[];
}

/** Stato del secondo fattore della sessione (DR-384): solo `verified` apre le aree. */
export type SecondFactorState = 'verified' | 'activation_required' | 'verification_required';

export interface CurrentUser {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly mustChangePassword: boolean;
  readonly secondFactor: SecondFactorState;
  readonly permissions: readonly string[];
  readonly activeRoleId: string | null;
  readonly activeArea: AreaId | null;
  readonly rolesHeld: readonly RoleHeld[];
}

/** Vero se la sessione aspetta ancora il secondo fattore: viene prima del cambio della password, come nell'API. */
export function secondFactorPending(user: CurrentUser): boolean {
  return (
    user.secondFactor === 'activation_required' || user.secondFactor === 'verification_required'
  );
}

/** Una veste: una coppia ruolo-area posseduta. È questo che il commutatore commuta. */
export interface Vestment {
  readonly id: string;
  readonly roleId: string;
  readonly roleLabel: string;
  readonly area: AreaId;
}

export function vestmentsOf(user: CurrentUser | null): Vestment[] {
  if (!user) return [];
  return user.rolesHeld.flatMap((role) =>
    role.areas.map((area) => ({
      id: `${role.roleId}:${area}`,
      roleId: role.roleId,
      roleLabel: role.label,
      area,
    })),
  );
}

interface SessionValue {
  readonly user: CurrentUser | null;
  readonly loading: boolean;
  signIn(email: string, password: string): Promise<CurrentUser>;
  signOut(): Promise<void>;
  chooseVestment(vestment: Vestment): Promise<CurrentUser>;
  refresh(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      // Senza sessione l'API risponde 204, che il client consegna come `undefined` (1G-24).
      setUser((await api<CurrentUser | undefined>('/auth/me')) ?? null);
    } catch (caught) {
      // Un 401 vale ancora «nessuna sessione»; tutto il resto risale, perché nasconderlo farebbe sembrare «non autenticato» un servizio rotto.
      if (caught instanceof ApiError && caught.status === 401) setUser(null);
      else throw caught;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      async signIn(email, password) {
        const next = await api<CurrentUser>('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        setUser(next);
        return next;
      },
      async signOut() {
        await api('/auth/logout', { method: 'POST' });
        setUser(null);
      },
      async chooseVestment(vestment) {
        const next = await api<CurrentUser>('/auth/context', {
          method: 'POST',
          body: { roleId: vestment.roleId, area: vestment.area },
        });
        setUser(next);
        return next;
      },
      refresh,
    }),
    [user, loading, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession va usato dentro <SessionProvider>.');
  return ctx;
}
