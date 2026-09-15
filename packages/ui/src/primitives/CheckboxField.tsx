import { useEffect, useId, useRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import './choice.css';

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string;
  /** Stato indeterminato, per la casella di intestazione di una tabella. */
  indeterminate?: boolean;
}

/** Componente 24: casella singola o di riga di tabella, con stato indeterminato. */
export function CheckboxField({
  label,
  indeterminate = false,
  className,
  ...rest
}: CheckboxFieldProps): React.JSX.Element {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label htmlFor={id} className="amoris-choice">
      <input
        id={id}
        ref={ref}
        type="checkbox"
        className={['amoris-focusable', 'amoris-choice__input', className].filter(Boolean).join(' ')}
        {...rest}
      />
      <span className="amoris-choice__label">{label}</span>
    </label>
  );
}
