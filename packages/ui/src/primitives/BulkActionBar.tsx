import { Button } from './Button.js';
import type { ButtonVariant } from './Button.js';
import './BulkActionBar.css';

export interface BulkAction {
  key: string;
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  /** DR-057: un'azione di gruppo non permessa nel ruolo attivo non si mostra. */
  permitted?: boolean;
}

export interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
  disabled?: boolean;
}

/**
 * Componente 18: sostituisce `TableToolbar` quando c'è una selezione.
 * Conteggio, azioni di gruppo, annulla selezione. Le azioni non permesse non
 * compaiono (DR-057), via la prop `permitted` di `Button`.
 */
export function BulkActionBar({
  selectedCount,
  actions,
  onClearSelection,
  disabled = false,
}: BulkActionBarProps): React.JSX.Element {
  return (
    <div className="amoris-bulk-action-bar" role="toolbar" aria-label="Azioni di gruppo">
      <span className="amoris-bulk-action-bar__count">{selectedCount} selezionati</span>
      <div className="amoris-bulk-action-bar__actions">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant ?? 'secondary'}
            onClick={action.onClick}
            loading={action.loading ?? false}
            permitted={action.permitted ?? true}
            disabled={disabled}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <div className="amoris-bulk-action-bar__cancel">
        <Button variant="tertiary" onClick={onClearSelection} disabled={disabled}>
          Annulla selezione
        </Button>
      </div>
    </div>
  );
}
