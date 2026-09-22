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
}

function MenuList({ nodes, depth, selectedId, onSelect, onMoveUp, onMoveDown, onIndent, onOutdent, onDelete, disabled }: MenuListProps): React.JSX.Element {
  return (
    <ul className="amoris-menu-tree">
      {nodes.map((node, index) => {
        const isFirst = index === 0;
        const isLast = index === nodes.length - 1;
        const isRoot = depth === 0;
        return (
          <li key={node.id}>
            <div
              className={['amoris-menu-tree__row', node.id === selectedId ? 'amoris-menu-tree__row--selected' : ''].filter(Boolean).join(' ')}
            >
              <button type="button" className="amoris-focusable amoris-menu-tree__label" onClick={() => onSelect(node.id)} disabled={disabled}>
                {node.label}
                <span className="amoris-menu-tree__target">
                  {TARGET_PREFIX[node.linkType]}
                  {node.linkTarget}
                </span>
              </button>
              <div className="amoris-menu-tree__actions">
                <IconButton icon={<span aria-hidden="true">↑</span>} label={`Sposta su: ${node.label}`} onClick={() => onMoveUp(node.id)} disabled={disabled || isFirst} />
                <IconButton icon={<span aria-hidden="true">↓</span>} label={`Sposta giù: ${node.label}`} onClick={() => onMoveDown(node.id)} disabled={disabled || isLast} />
                <IconButton icon={<span aria-hidden="true">→</span>} label={`Annida: ${node.label}`} onClick={() => onIndent(node.id)} disabled={disabled || isFirst} />
                <IconButton icon={<span aria-hidden="true">←</span>} label={`Riporta al livello superiore: ${node.label}`} onClick={() => onOutdent(node.id)} disabled={disabled || isRoot} />
                <IconButton icon={<span aria-hidden="true">🗑</span>} label={`Elimina: ${node.label}`} onClick={() => onDelete(node.id)} disabled={disabled} />
              </div>
            </div>
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
 * collega a un contenuto, a una categoria o a un indirizzo — con comandi espliciti
 * (Sposta su/giù, Annida, Riporta al livello superiore), non con il
 * trascinamento.
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
    />
  );
}
