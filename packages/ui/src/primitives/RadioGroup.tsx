import { useId } from 'react';
import './choice.css';

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name?: string;
  legend: string;
  options: RadioOption[];
  value: string | null;
  onChange: (value: string) => void;
  errorText?: string;
}

/** Componente 25: scelta esclusiva, usata dal pannello di visibilità. */
export function RadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
  errorText,
}: RadioGroupProps): React.JSX.Element {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <fieldset className="amoris-radio-group">
      <legend className="amoris-field__label">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="amoris-choice">
          <input
            type="radio"
            name={groupName}
            className="amoris-focusable amoris-choice__input"
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          <span className="amoris-choice__label">{option.label}</span>
        </label>
      ))}
      {errorText ? (
        <p className="amoris-field__error" role="alert">
          {errorText}
        </p>
      ) : null}
    </fieldset>
  );
}
