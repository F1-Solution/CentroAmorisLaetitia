'use client';

import {
  ActiveContextBadge,
  AppShell,
  AreaNav,
  Breadcrumbs,
  DensityToggle,
  RoleSwitcher,
  SectionNav,
  TopBar,
  UserMenu,
} from '@amoris/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AREA_DEFINITIONS, type AreaId } from '../lib/areas';
import { choiceUrlFor } from '../lib/returnPath';
import { useSession, vestmentsOf } from '../lib/session';

export interface AreaShellProps {
  /** Area a cui la schermata appartiene. Se non è quella attiva, si cambia veste. */
  readonly area: AreaId;
  readonly sectionId: string;
  readonly breadcrumbs: readonly { label: string; href?: string }[];
  readonly children: ReactNode;
  readonly registerBar?: ReactNode;
}

/**
 * Guscio di un'area. Mette insieme i componenti 1-7 di `packages/ui` e li lega
 * alla sessione vera, che è la parte che `1D-W7` non poteva avere.
 *
 * Tre cose che valgono in ogni schermata (`design-system.md` §8.3):
 *
 * - l'**ambiente attivo è dichiarato in parole compiute**, non con un'icona né
 *   con un colore soltanto — «Stai lavorando come Redazione»;
 * - il **commutatore** sta in alto a destra, con lo stesso nome e la stessa
 *   posizione ovunque, e `UserMenu` gli sta **accanto**: cambiare veste e
 *   disconnettersi sono due gesti diversi;
 * - **un'area che non si possiede non compare**, né attiva né spenta (DR-057).
 *
 * I tre componenti di navigazione ricevono il **collegamento di Next**: senza,
 * userebbero un'ancora normale, che non conosce il prefisso `/admin` sotto cui
 * quest'area è servita, e ogni voce porterebbe fuori dall'applicazione. Fino al
 * 2026-09-23 era così.
 *
 * Il commutatore commuta **vesti**, non ruoli: in Fase 1 il ruolo è uno solo e
 * ciò che si cambia è l'area, che è esattamente ciò che `ux-proposals.md` §4.3
 * chiama veste.
 */
export function AreaShell({
  area,
  sectionId,
  breadcrumbs,
  children,
  registerBar,
}: AreaShellProps): React.JSX.Element | null {
  const router = useRouter();
  const { user, loading, signOut, chooseVestment } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [switching, setSwitching] = useState(false);

  const vestments = vestmentsOf(user);

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
    if (!user.activeArea) {
      router.replace(choiceUrlFor(window.location.pathname, window.location.search));
      return;
    }
    // Arrivati in un'area diversa da quella indossata: non si indovina, si
    // manda a scegliere. Cambiare veste da solo al posto della persona
    // vanificherebbe il punto 2 del §4.4, che è proprio non poterlo fare per
    // distrazione; il percorso di arrivo si conserva per dopo la scelta.
    if (user.activeArea !== area) {
      router.replace(choiceUrlFor(window.location.pathname, window.location.search));
    }
  }, [loading, user, area, router]);

  if (loading || !user || user.mustChangePassword || user.activeArea !== area) return null;

  const definition = AREA_DEFINITIONS[area];
  const ownedAreas = [...new Set(vestments.map((vestment) => vestment.area))];
  const activeVestmentId = `${user.activeRoleId}:${area}`;

  async function onSwitch(id: string): Promise<void> {
    const vestment = vestments.find((entry) => entry.id === id);
    if (!vestment || vestment.id === activeVestmentId) return;
    setSwitching(true);
    await chooseVestment(vestment);
    router.push(AREA_DEFINITIONS[vestment.area].href);
    setSwitching(false);
  }

  return (
    <AppShell
      topBar={
        <TopBar
          breadcrumbs={<Breadcrumbs link={Link} items={breadcrumbs.map((item) => ({ ...item }))} />}
          search={<DensityToggle />}
          roleSwitcher={
            <RoleSwitcher
              roles={vestments.map((vestment) => ({
                id: vestment.id,
                label: AREA_DEFINITIONS[vestment.area].label,
                description: AREA_DEFINITIONS[vestment.area].description,
              }))}
              activeRoleId={activeVestmentId}
              onChange={(id) => void onSwitch(id)}
              loading={switching}
            />
          }
          userMenu={
            <UserMenu
              name={user.fullName}
              email={user.email}
              onSignOut={() => {
                void signOut().then(() => router.replace('/accesso'));
              }}
            />
          }
        />
      }
      areaNav={
        <AreaNav
          link={Link}
          areas={ownedAreas.map((owned) => ({
            id: owned,
            label: AREA_DEFINITIONS[owned].label,
            icon: AREA_DEFINITIONS[owned].icon,
            href: AREA_DEFINITIONS[owned].href,
          }))}
          activeAreaId={area}
        />
      }
      sectionNav={
        <SectionNav
          link={Link}
          groups={definition.groups.map((group) => ({
            ...group,
            sections: group.sections.map((section) => ({ ...section })),
          }))}
          activeSectionId={sectionId}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((previous) => !previous)}
        />
      }
      {...(registerBar ? { registerBar } : {})}
    >
      <ActiveContextBadge areaLabel={definition.label} />
      {children}
    </AppShell>
  );
}
