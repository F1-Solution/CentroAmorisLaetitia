import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import './fields.css';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  helpText?: string;
  errorText?: string;
}

/** Componente 22: campo di testo a più righe. */
export function TextArea({
  label,
  helpText,
  errorText,
  className,
  disabled,
  rows = 4,
  ...rest
}: TextAreaProps): React.JSX.Element {
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
      <textarea
        id={id}
        className={classes}
        disabled={disabled}
        rows={rows}
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
