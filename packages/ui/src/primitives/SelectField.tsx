import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import './fields.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: SelectOption[];
  helpText?: string;
  errorText?: string;
  /** Voce per lo stato vuoto V, quando `options` è vuoto. */
  emptyText?: string;
}

/**
 * Componente 23: scelta da elenco chiuso.
 *
 * **Scostamento dichiarato.** Il capitolo 6 descrive una ricerca sopra le dieci
 * voci. Questa wave costruisce la primitiva come elenco nativo accessibile da
 * tastiera; il campo di ricerca sopra un elenco lungo è un comportamento
 * aggiuntivo che non rientra nel tempo di questa wave e resta per `1D-W8`, che lo
 * userà per primo con dati reali di lunghezza nota.
 */
export function SelectField({
  label,
  options,
  helpText,
  errorText,
  emptyText = 'Nessuna voce disponibile.',
  className,
  disabled,
  ...rest
}: SelectFieldProps): React.JSX.Element {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errorText);
  const isEmpty = options.length === 0;

  const classes = [
    'amoris-focusable',
    'amoris-field-input',
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
      {isEmpty ? (
        <p className="amoris-field__help">{emptyText}</p>
      ) : (
        <select
          id={id}
          className={classes}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={
            [helpText ? helpId : null, hasError ? errorId : null].filter(Boolean).join(' ') ||
            undefined
          }
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
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
