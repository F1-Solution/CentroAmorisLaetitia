import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import './fields.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Testo di aiuto permanente sotto il campo (§6, componente 21; decisione 6). */
  helpText?: string;
  /** Messaggio di errore. Se presente il campo è in stato E. */
  errorText?: string;
}

/** Componente 21: campo di testo a riga singola, etichetta sopra, mai dentro. */
export function TextField({
  label,
  helpText,
  errorText,
  className,
  disabled,
  ...rest
}: TextFieldProps): React.JSX.Element {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errorText);

  const classes = ['amoris-focusable', 'amoris-field-input', hasError ? 'amoris-field-input--error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="amoris-field">
      <label htmlFor={id} className="amoris-field__label">
        {label}
      </label>
      <input
        id={id}
        className={classes}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={[helpText ? helpId : null, hasError ? errorId : null].filter(Boolean).join(' ') || undefined}
        {...rest}
      />
      {helpText ? (
        <p id={helpId} className="amoris-field__help">
          {helpText}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className="amoris-field__error" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
