import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import './fields.css';
import './DateTimeField.css';

export interface DateTimeFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'value' | 'onChange'
> {
  label: string;
  /** Formato `input[type=datetime-local]`: `AAAA-MM-GGTHH:mm`. */
  value: string;
  onChange: (value: string) => void;
  helpText?: string;
  errorText?: string;
}

/**
 * Componente 26: data e ora della pubblicazione. Cifre tabellari (§3.1) e
 * immissione sempre possibile da tastiera: si usa il controllo nativo
 * `datetime-local`, che il browser espone come campo interamente digitabile.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  helpText,
  errorText,
  className,
  disabled,
  ...rest
}: DateTimeFieldProps): React.JSX.Element {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errorText);

  const classes = [
    'amoris-focusable',
    'amoris-field-input',
    'amoris-datetime-field__input',
    hasError ? 'amoris-field-input--error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="amoris-field">
      <label htmlFor={id} className="amoris-field__label">
        {label}
      </label>
      <input
        id={id}
        type="datetime-local"
        className={classes}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={
          [helpText ? helpId : null, hasError ? errorId : null].filter(Boolean).join(' ') ||
          undefined
        }
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
