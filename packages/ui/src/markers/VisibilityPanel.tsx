import { RadioGroup } from '../primitives/RadioGroup.js';
import './VisibilityPanel.css';

export type Visibility = 'public' | 'restricted';

export interface VisibilityPanelProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
  /** Riga fissa che ricorda chi può vedere il record, nella scelta corrente. */
  visibleToText: string;
  disabled?: boolean;
  errorText?: string;
}

/**
 * Componente 37: pannello di visibilità di un contenuto. Fondo
 * `restricted-surface` e testo `restricted-ink` quando la scelta è «riservato»
 * (prestito 3, §6).
 */
export function VisibilityPanel({
  value,
  onChange,
  visibleToText,
  disabled,
  errorText,
}: VisibilityPanelProps): React.JSX.Element {
  const isRestricted = value === 'restricted';

  return (
    <div className={`amoris-visibility-panel ${isRestricted ? 'amoris-visibility-panel--restricted' : ''}`}>
      <RadioGroup
        legend="Visibilità"
        value={value}
        onChange={(next) => !disabled && onChange(next as Visibility)}
        {...(errorText !== undefined ? { errorText } : {})}
        options={[
          { value: 'public', label: 'Visibile a tutta l\'area', ...(disabled !== undefined ? { disabled } : {}) },
          { value: 'restricted', label: 'Riservato', ...(disabled !== undefined ? { disabled } : {}) },
        ]}
      />
      <p className="amoris-visibility-panel__note">{visibleToText}</p>
    </div>
  );
}
