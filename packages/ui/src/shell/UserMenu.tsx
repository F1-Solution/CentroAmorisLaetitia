import { useId, useRef, useState } from 'react';
import { useOutsideDismiss } from './useOutsideDismiss.js';
import './UserMenu.css';

export interface UserMenuProps {
  name: string;
  email: string;
  onSignOut: () => void;
}

/**
 * Componente 6: menu della persona in alto a destra. Sta **accanto** al
 * `RoleSwitcher`, non al suo posto (§6): cambiare ruolo e disconnettersi sono
 * due gesti diversi, due componenti diversi.
 */
export function UserMenu({ name, email, onSignOut }: UserMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideDismiss(containerRef, open, () => setOpen(false));

  return (
    <div className="amoris-user-menu" ref={containerRef}>
      <button
        type="button"
        className="amoris-focusable amoris-user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        {name}
      </button>
      {open ? (
        <div id={menuId} role="menu" className="amoris-user-menu__panel">
          <p className="amoris-user-menu__name">{name}</p>
          <p className="amoris-user-menu__email">{email}</p>
          <button
            type="button"
            role="menuitem"
            className="amoris-focusable amoris-user-menu__signout"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Disconnetti
          </button>
        </div>
      ) : null}
    </div>
  );
}
