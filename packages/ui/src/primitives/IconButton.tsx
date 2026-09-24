import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './IconButton.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** Etichetta accessibile, obbligatoria (§9.5, inventario #15). */
  label: string;
  /** DR-057: quando `false` il bottone non si rende. */
  permitted?: boolean;
}

/** Componente 15 dell'inventario: bottone di sola icona. */
export function IconButton({
  icon,
  label,
  permitted = true,
  className,
  disabled,
  ...rest
}: IconButtonProps): React.JSX.Element | null {
  if (!permitted) return null;

  const classes = ['amoris-focusable', 'amoris-icon-button', className].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={label}
      disabled={disabled}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
