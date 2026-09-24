import './ColumnRatioControl.css';

export interface ColumnRatioOption {
  /** Es. `"1_2,1_2"` — la ripartizione delle colonne di una riga (BLOCK-MODEL.md §3.2). */
  value: string;
  label: string;
}

export interface ColumnRatioControlProps {
  value: string;
  options: ColumnRatioOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Componente 43: cambia la ripartizione delle colonne di una riga. È l'unica
 * modifica di impaginazione ammessa in Fase 1 (ADR-006 §3.2).
 */
export function ColumnRatioControl({
  value,
  options,
  onChange,
  disabled = false,
}: ColumnRatioControlProps): React.JSX.Element {
  return (
    <div className="amoris-column-ratio" role="radiogroup" aria-label="Ripartizione delle colonne">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className="amoris-focusable amoris-column-ratio__option"
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
