import type { ReactNode } from 'react';
import './fields.css';

export interface FieldGroupProps {
  title: string;
  description?: string;
  children: ReactNode;
  disabled?: boolean;
}

/** Componente 27: gruppo di campi con titolo in maiuscoletto, es. "PUBBLICAZIONE". */
export function FieldGroup({
  title,
  description,
  children,
  disabled,
}: FieldGroupProps): React.JSX.Element {
  return (
    <fieldset className="amoris-field-group" disabled={disabled}>
      <legend className="amoris-field-group__title">{title}</legend>
      {description ? <p className="amoris-field-group__description">{description}</p> : null}
      {children}
    </fieldset>
  );
}
