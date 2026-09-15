import type { ReactNode } from 'react';
import { SkipLink } from '../primitives/SkipLink.js';
import './AppShell.css';

export interface AppShellProps {
  topBar: ReactNode;
  areaNav: ReactNode;
  sectionNav: ReactNode;
  children: ReactNode;
  /** Barra di registro in fondo, ad esempio `SaveBar` (componente 29). */
  registerBar?: ReactNode;
  loading?: boolean;
  /** Identificativo del contenuto, usato da `SkipLink`. */
  contentId?: string;
}

/**
 * Componente 1: guscio a due colonne di navigazione più barra superiore, area
 * di lavoro e barra di registro in fondo.
 *
 * **Ordine di tabulazione** (§9.3): `SkipLink`, `TopBar`, `AreaNav`,
 * `SectionNav`, area di lavoro, barra di registro — è anche l'ordine del DOM
 * qui sotto, così i due ordini coincidono senza alcun `tabindex` positivo.
 *
 * **Punti di rottura** (§4.3): sotto `bp-sm` le due colonne di navigazione
 * scompaiono (regola in `AreaNav.css` e `SectionNav.css`); il comportamento
 * completo della barra inferiore in sostituzione appartiene alle schermate di
 * `1D-W8`, non a questo guscio.
 */
export function AppShell({
  topBar,
  areaNav,
  sectionNav,
  children,
  registerBar,
  loading = false,
  contentId = 'amoris-app-shell-content',
}: AppShellProps): React.JSX.Element {
  return (
    <div className="amoris-app-shell" aria-busy={loading || undefined}>
      <SkipLink targetId={contentId} />
      {topBar}
      <div className="amoris-app-shell__body">
        {areaNav}
        {sectionNav}
        <main id={contentId} className="amoris-app-shell__content" tabIndex={-1}>
          {children}
        </main>
      </div>
      {registerBar ? <div className="amoris-app-shell__register-bar">{registerBar}</div> : null}
    </div>
  );
}
