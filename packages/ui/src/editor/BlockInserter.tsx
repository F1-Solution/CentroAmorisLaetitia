import { Dialog } from '../layout/Dialog';
import { TextField } from '../primitives/TextField';
import { insertableBlockTypes } from './block-types';
import type { BlockType } from './block-types';
import './BlockInserter.css';

export interface BlockInserterProps {
  open: boolean;
  onClose: () => void;
  onInsert: (type: BlockType) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  /**
   * Tipi che in questo punto dell'albero non si possono creare: restano **in
   * elenco e spenti**, con il motivo scritto. Toglierli farebbe sembrare che
   * non esistano, che è un'altra cosa.
   */
  unavailableTypes?: readonly BlockType[];
  unavailableReason?: string;
}

/**
 * Componente 42: «Aggiungi blocco». Elenco dei 14 tipi di BLOCK-MODEL.md §3,
 * con ricerca; l'insieme è **chiuso** e non si allarga in Fase 1.
 */
export function BlockInserter({
  open,
  onClose,
  onInsert,
  searchValue,
  onSearchChange,
  unavailableTypes = [],
  unavailableReason,
}: BlockInserterProps): React.JSX.Element | null {
  if (!open) return null;

  const query = searchValue.trim().toLowerCase();
  const filtered = query
    ? insertableBlockTypes.filter((option) => option.label.toLowerCase().includes(query))
    : insertableBlockTypes;
  const hasUnavailable = filtered.some((option) => unavailableTypes.includes(option.type));

  return (
    <Dialog open={open} onClose={onClose} title="Aggiungi blocco">
      <div className="amoris-block-inserter__search">
        <TextField
          label="Cerca un blocco"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="amoris-block-inserter__empty">Nessun blocco trovato con «{searchValue}».</p>
      ) : (
        <ul className="amoris-block-inserter__list">
          {filtered.map((option) => {
            const unavailable = unavailableTypes.includes(option.type);
            return (
              <li key={option.type}>
                <button
                  type="button"
                  className="amoris-focusable amoris-block-inserter__item"
                  onClick={() => onInsert(option.type)}
                  disabled={unavailable}
                  {...(unavailable && unavailableReason
                    ? { 'aria-describedby': 'amoris-block-inserter-reason' }
                    : {})}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hasUnavailable && unavailableReason ? (
        <p className="amoris-block-inserter__reason" id="amoris-block-inserter-reason">
          {unavailableReason}
        </p>
      ) : null}
    </Dialog>
  );
}
