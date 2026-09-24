import type { ReactNode } from 'react';
import { CheckboxField } from './CheckboxField';
import './DataTable.css';

export type SortDirection = 'asc' | 'desc' | null;

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  sortable?: boolean;
  /** Colonna numerica o data: cifre tabellari, allineata a destra. */
  numeric?: boolean;
}

export interface DataTableProps<Row> {
  columns: Array<DataTableColumn<Row>>;
  rows: Row[];
  getRowId: (row: Row) => string;
  caption: string;
  loading?: boolean;
  errorText?: string;
  emptyText?: string;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSortChange?: (key: string) => void;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
}

/**
 * Componente 16: tabella densa. Intestazione ordinabile, selezione multipla,
 * cifre tabellari, nessuna zebratura (§6, righe distinte solo da `border` e
 * `surface-hover`/`surface-selected`).
 *
 * **Scostamento dichiarato.** Il documento prevede intestazione fissa allo
 * scorrimento, priorità di colonna sotto `bp-lg` e schede impilate sotto
 * `bp-sm`. Questa wave costruisce la tabella con dati statici; il comportamento
 * di scorrimento e i punti di rottura si verificano con schermate reali in
 * `1D-W8` e non sono provati qui.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  caption,
  loading = false,
  errorText,
  emptyText = 'Nessun elemento da mostrare.',
  sortKey,
  sortDirection = null,
  onSortChange,
  selectedIds,
  onSelectedIdsChange,
}: DataTableProps<Row>): React.JSX.Element {
  const selectable = Boolean(onSelectedIdsChange);
  const selected = selectedIds ?? [];
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const someSelected = selected.length > 0 && !allSelected;

  function toggleAll() {
    if (!onSelectedIdsChange) return;
    onSelectedIdsChange(allSelected ? [] : rows.map(getRowId));
  }

  function toggleOne(id: string) {
    if (!onSelectedIdsChange) return;
    onSelectedIdsChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
  }

  if (errorText) {
    return (
      <div className="amoris-datatable__status amoris-datatable__status--error" role="alert">
        {errorText}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="amoris-datatable__status" aria-busy="true">
        Caricamento in corso…
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="amoris-datatable__status">{emptyText}</div>;
  }

  return (
    <table className="amoris-datatable">
      <caption className="amoris-datatable__caption">{caption}</caption>
      <thead>
        <tr>
          {selectable ? (
            <th scope="col" className="amoris-datatable__select-col">
              <CheckboxField
                label="Seleziona tutte le righe"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleAll}
              />
            </th>
          ) : null}
          {columns.map((column) => {
            const isSorted = sortKey === column.key;
            return (
              <th
                key={column.key}
                scope="col"
                className={column.numeric ? 'amoris-datatable__col--numeric' : undefined}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    className="amoris-focusable amoris-datatable__sort"
                    onClick={() => onSortChange?.(column.key)}
                    aria-sort={
                      isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    {column.header}
                    {isSorted ? (
                      <span aria-hidden="true">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                    ) : null}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const id = getRowId(row);
          const isSelected = selected.includes(id);
          return (
            <tr
              key={id}
              className={isSelected ? 'amoris-datatable__row--selected' : undefined}
              aria-selected={selectable ? isSelected : undefined}
            >
              {selectable ? (
                <td className="amoris-datatable__select-col">
                  <CheckboxField
                    label={`Seleziona riga`}
                    checked={isSelected}
                    onChange={() => toggleOne(id)}
                  />
                </td>
              ) : null}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.numeric ? 'amoris-datatable__col--numeric' : undefined}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
