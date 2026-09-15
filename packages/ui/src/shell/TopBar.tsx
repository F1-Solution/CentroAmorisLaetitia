import type { ReactNode } from 'react';
import './TopBar.css';

export interface TopBarProps {
  breadcrumbs: ReactNode;
  search?: ReactNode;
  roleSwitcher?: ReactNode;
  userMenu?: ReactNode;
  loading?: boolean;
}

/**
 * Componente 4: barra superiore **chiara, mai scura** (DR-018). Il colore
 * fisso è deliberato: nessuna variabile di tema scuro entra in questo file.
 */
export function TopBar({ breadcrumbs, search, roleSwitcher, userMenu, loading = false }: TopBarProps): React.JSX.Element {
  return (
    <header className="amoris-top-bar" aria-busy={loading || undefined}>
      <div className="amoris-top-bar__breadcrumbs">{breadcrumbs}</div>
      <div className="amoris-top-bar__actions">
        {search}
        {roleSwitcher}
        {userMenu}
      </div>
    </header>
  );
}
