import type { ReactNode } from 'react';
import { IconButton } from '../primitives/IconButton';
import { Spinner } from '../primitives/Spinner';
import './MenuTreeEditor.css';

export interface MenuItemNode {
  id: string;
  label: string;
  /**
   * `term` esiste perché una voce di menu può puntare a una categoria e non a
   * una pagina: la sorgente WordPress ne ha, e mostrarle come «Indirizzo»
   * direbbe una cosa falsa a chi le legge.
   */
  linkType: 'content' | 'term' | 'url';
  /** Titolo del contenuto, nome della categoria o indirizzo, secondo `linkType`. */
  linkTarget: string;
  children?: MenuItemNode[];
}

/** Come si avvolge la riga di una voce, senza i suoi figli (DR-082). */
export interface MenuTreeRowRenderProps {
  readonly id: string;
  readonly children: ReactNode;
}

export interface MenuTreeEditorProps {
  items: MenuItemNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  /** Annida la voce sotto la voce precedente allo stesso livello. */
  onIndent: (id: string) => void;
  /** Riporta la voce al livello del suo genitore. */
  onOutdent: (id: string) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
  errorText?: string;
  emptyText?: string;
  disabled?: boolean;
  /**
   * Trascinamento (DR-082): chi lo usa avvolge la riga dall'esterno, e
   * `packages/ui` resta senza la libreria (`PLAN.md` §5). Assente, l'albero
   * funziona con i soli bottoni.
   */
  renderRow?: (props: MenuTreeRowRenderProps) => React.JSX.Element;
}

const TARGET_PREFIX: Readonly<Record<MenuItemNode['linkType'], string>> = {
  content: 'Contenuto: ',
  term: 'Categoria: ',
  url: 'Indirizzo: ',
};

interface MenuListProps {
  nodes: MenuItemNode[];
  depth: number;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
  renderRow: ((props: MenuTreeRowRenderProps) => React.JSX.Element) | undefined;
}

/**
 * L'involucro si rende come **componente**, mai chiamato come funzione: usa
 * degli hook, e chiamato così li metterebbe nel componente che lo contiene, con
 * un numero che cambia insieme alle righe (React #310).
 */
function wrapRow(
  id: string,
  row: React.JSX.Element,
  renderRow: ((props: MenuTreeRowRenderProps) => React.JSX.Element) | undefined,
): React.JSX.Element {
  if (!renderRow) return row;
  const Row = renderRow;
  return <Row id={id}>{row}</Row>;
}

function MenuList({
  nodes,
  depth,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  onDelete,
  disabled,
  renderRow,
}: MenuListProps): React.JSX.Element {
  return (
    <ul className="amoris-menu-tree">
      {nodes.map((node, index) => {
        const isFirst = index === 0;
        const isLast = index === nodes.length - 1;
        const isRoot = depth === 0;
        return (
          <li key={node.id}>
            {wrapRow(
              node.id,
              <div
                className={[
                  'amoris-menu-tree__row',
                  node.id === selectedId ? 'amoris-menu-tree__row--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  className="amoris-focusable amoris-menu-tree__label"
                  onClick={() => onSelect(node.id)}
                  disabled={disabled}
                >
                  {node.label}
                  <span className="amoris-menu-tree__target">
                    {TARGET_PREFIX[node.linkType]}
                    {node.linkTarget}
                  </span>
                </button>
                <div className="amoris-menu-tree__actions">
                  <IconButton
                    icon={<span aria-hidden="true">↑</span>}
                    label={`Sposta su: ${node.label}`}
                    onClick={() => onMoveUp(node.id)}
                    disabled={disabled || isFirst}
                  />
                  <IconButton
                    icon={<span aria-hidden="true">↓</span>}
                    label={`Sposta giù: ${node.label}`}
                    onClick={() => onMoveDown(node.id)}
                    disabled={disabled || isLast}
                  />
                  <IconButton
                    icon={<span aria-hidden="true">→</span>}
                    label={`Annida: ${node.label}`}
                    onClick={() => onIndent(node.id)}
                    disabled={disabled || isFirst}
                  />
                  <IconButton
                    icon={<span aria-hidden="true">←</span>}
                    label={`Riporta al livello superiore: ${node.label}`}
                    onClick={() => onOutdent(node.id)}
                    disabled={disabled || isRoot}
                  />
                  <IconButton
                    icon={<span aria-hidden="true">🗑</span>}
                    label={`Elimina: ${node.label}`}
                    onClick={() => onDelete(node.id)}
                    disabled={disabled}
                  />
                </div>
              </div>,
              renderRow,
            )}
            {node.children && node.children.length > 0 ? (
              <div className="amoris-menu-tree__children">
                <MenuList
                  nodes={node.children}
                  depth={depth + 1}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onIndent={onIndent}
                  onOutdent={onOutdent}
                  onDelete={onDelete}
                  disabled={disabled}
                  renderRow={renderRow}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Componente 46: albero del menu di navigazione del sito. Sposta, annida,
 * collega a un contenuto, a una categoria o a un indirizzo, con comandi espliciti
 * (Sposta su/giù, Annida, Riporta al livello superiore); il trascinamento si
 * aggiunge dall'esterno con `renderRow` (DR-082).
 */
export function MenuTreeEditor({
  items,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  onDelete,
  loading = false,
  errorText,
  emptyText = 'Il menu non contiene ancora voci.',
  disabled = false,
  renderRow,
}: MenuTreeEditorProps): React.JSX.Element {
  if (errorText) {
    return (
      <p className="amoris-menu-tree__status" role="alert">
        {errorText}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="amoris-menu-tree__status">
        <Spinner label="Caricamento del menu in corso…" />
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="amoris-menu-tree__status">{emptyText}</p>;
  }

  return (
    <MenuList
      nodes={items}
      depth={0}
      selectedId={selectedId}
      onSelect={onSelect}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onIndent={onIndent}
      onOutdent={onOutdent}
      onDelete={onDelete}
      disabled={disabled}
      renderRow={renderRow}
    />
  );
}
