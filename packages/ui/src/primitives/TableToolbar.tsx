import { TextField } from './TextField';
import { SelectField } from './SelectField';
import type { SelectOption } from './SelectField';
import { Button } from './Button';
import './TableToolbar.css';

export interface TableToolbarFilter {
  key: string;
  label: string;
  /** La prima voce è il valore "nessun filtro"; non conta nel numero di filtri attivi. */
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface TableToolbarProps {
  searchLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  /**
   * Filtri (stato, autore, ordinamento…). Quando l'elenco è vuoto il
   * componente rende solo la ricerca: è lo stato V dell'inventario, perché una
   * lista è realistica solo dopo che la schermata che la usa dichiara i suoi
   * filtri.
   */
  filters?: TableToolbarFilter[];
  onResetFilters?: () => void;
  disabled?: boolean;
}

function countActiveFilters(filters: TableToolbarFilter[]): number {
  return filters.filter((filter) => {
    const first = filter.options[0];
    return first !== undefined && filter.value !== first.value;
  }).length;
}

/** Componente 17: riga di filtri sopra la tabella, con conteggio dei filtri attivi. */
export function TableToolbar({
  searchLabel,
  searchValue,
  onSearchChange,
  filters = [],
  onResetFilters,
  disabled = false,
}: TableToolbarProps): React.JSX.Element {
  const activeCount = countActiveFilters(filters);

  return (
    <div className="amoris-table-toolbar" role="search">
      <div className="amoris-table-toolbar__search">
        <TextField
          label={searchLabel}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          disabled={disabled}
        />
      </div>
      {filters.map((filter) => (
        <div className="amoris-table-toolbar__field" key={filter.key}>
          <SelectField
            label={filter.label}
            options={filter.options}
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
            disabled={disabled}
          />
        </div>
      ))}
      {activeCount > 0 ? (
        <span className="amoris-table-toolbar__count" aria-label={`${activeCount} filtri attivi`}>
          {activeCount}
        </span>
      ) : null}
      {activeCount > 0 && onResetFilters ? (
        <div className="amoris-table-toolbar__reset">
          <Button variant="tertiary" onClick={onResetFilters} disabled={disabled}>
            Azzera filtri
          </Button>
        </div>
      ) : null}
    </div>
  );
}
