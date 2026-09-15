import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** In caricamento: L nell'inventario. Disabilita il click, non nasconde il testo. */
  loading?: boolean;
  /**
   * Decisione 7 (DR-057): un'azione non permessa nel ruolo attivo **non si
   * mostra**, non si mostra disabilitata. Quando `false`, il componente non
   * rende nulla. Predefinito `true` perché la maggior parte dei bottoni non è
   * governata da un permesso.
   */
  permitted?: boolean;
}

/** Componente 14 dell'inventario: bottone principale, secondario, terziario, distruttivo. */
export function Button({
  variant = 'primary',
  loading = false,
  permitted = true,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps): React.JSX.Element | null {
  if (!permitted) return null;

  const classes = ['amoris-focusable', 'amoris-button', `amoris-button--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="amoris-button__spinner" aria-hidden="true" /> : null}
      <span className="amoris-button__label">{children}</span>
    </button>
  );
}
