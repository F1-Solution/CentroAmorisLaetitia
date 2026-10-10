import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getMenu, getSettings, settingString } from '../lib/api';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/** Il menu del tema (`menus.key`), come lo vede chi non ha fatto accesso. */
const MENU_PRINCIPALE = 'menu-principale';

/**
 * L'involucro di ogni pagina: intestazione, contenuto, piè di pagina, con la
 * struttura del tema (`#page-container`, `#et-main-area`). Sta nella pagina e
 * non nel layout perché l'intestazione deve sapere qual è la voce attiva.
 */
export async function SiteShell({
  currentPath,
  children,
}: {
  readonly currentPath: string;
  readonly children: ReactNode;
}) {
  // Ogni pagina si rende alla richiesta, anche la 404 (DR-105): niente resa alla compilazione.
  await connection();
  const [settings, menu] = await Promise.all([getSettings(), getMenu(MENU_PRINCIPALE)]);
  const logoPath = settingString(settings, 'site.logo_path') || null;
  return (
    <div id="page-container">
      <SiteHeader
        siteTitle={settingString(settings, 'site.title')}
        logoPath={logoPath}
        menu={menu?.items ?? []}
        currentPath={currentPath}
      />
      <div id="et-main-area">
        <div id="main-content">{children}</div>
        <SiteFooter footerHtml={settingString(settings, 'site.footer_html')} />
      </div>
    </div>
  );
}
