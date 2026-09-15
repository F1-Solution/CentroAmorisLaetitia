import { useId, useRef, useState } from 'react';
import type { RoleOption } from './types.js';
import { useOutsideDismiss } from './useOutsideDismiss.js';
import './RoleSwitcher.css';

export interface RoleSwitcherProps {
  /** Solo i ruoli posseduti dalla persona (§6, componente 7). */
  roles: RoleOption[];
  activeRoleId: string;
  onChange: (roleId: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Componente 7: commutatore di ruolo e di ambiente (DR-050).
 *
 * **Con un solo ruolo posseduto il componente non si mostra come un
 * commutatore**: niente freccia, niente menu, perché non c'è nulla da
 * commutare — mostrarlo comunque suggerirebbe una scelta che non esiste. Resta
 * comunque visibile una pastiglia statica con lo stesso aspetto, perché
 * l'ambiente attivo deve restare leggibile ovunque (§8.3 punto 1).
 */
export function RoleSwitcher({ roles, activeRoleId, onChange, disabled = false, loading = false }: RoleSwitcherProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  useOutsideDismiss(containerRef, open, () => setOpen(false));

  const activeRole = roles.find((role) => role.id === activeRoleId) ?? roles[0];
  if (!activeRole) return null;

  const pillClasses = ['amoris-role-switcher__pill', activeRole.elevated ? 'amoris-role-switcher__pill--elevated' : '']
    .filter(Boolean)
    .join(' ');

  if (roles.length <= 1) {
    return (
      <div className="amoris-role-switcher amoris-role-switcher--single">
        <span className={pillClasses}>{activeRole.label}</span>
      </div>
    );
  }

  return (
    <div className="amoris-role-switcher" ref={containerRef}>
      <button
        type="button"
        className={`amoris-focusable amoris-role-switcher__trigger ${pillClasses}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        onClick={() => setOpen((current) => !current)}
      >
        {activeRole.label}
        <span className="amoris-role-switcher__arrow" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul id={menuId} role="menu" className="amoris-role-switcher__menu">
          {roles.map((role) => (
            <li key={role.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={role.id === activeRoleId}
                className="amoris-focusable amoris-role-switcher__option"
                onClick={() => {
                  setOpen(false);
                  onChange(role.id);
                }}
              >
                <span className="amoris-role-switcher__option-label">{role.label}</span>
                <span className="amoris-role-switcher__option-description">{role.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
