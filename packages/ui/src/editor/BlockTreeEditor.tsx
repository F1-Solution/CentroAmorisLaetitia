import { IconButton } from '../primitives/IconButton.js';
import { Button } from '../primitives/Button.js';
import { Spinner } from '../primitives/Spinner.js';
import type { BlockType } from './block-types.js';
import './BlockTreeEditor.css';

export interface BlockNode {
  id: string;
  type: BlockType;
  /** Riepilogo del blocco, per esempio l'inizio del testo o il titolo dell'immagine. */
  label: string;
  /** Presente solo sui blocchi contenitore (per esempio `media_text`). */
  children?: BlockNode[];
}

export interface BlockTreeEditorProps {
  blocks: BlockNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Comandi espliciti: nessun trascinamento (§8, CONTEXT.md §8). */
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
  /** `parentId` è `null` per aggiungere alla radice della colonna. */
  onAddRequest: (parentId: string | null) => void;
  loading?: boolean;
  errorText?: string;
  emptyText?: string;
}

const TYPE_LABEL: Record<BlockType, string> = {
  section: 'Sezione',
  row: 'Riga',
  column: 'Colonna',
  rich_text: 'Testo',
  image: 'Immagine',
  media_text: 'Media e testo',
  video: 'Video',
  map: 'Mappa',
  separator: 'Separatore',
  form: 'Modulo',
  post_list: 'Elenco di contenuti',
  document: 'Documento',
  slider: 'Presentazione a scorrimento',
  html: 'HTML (riserva)',
};

interface BlockListProps {
  nodes: BlockNode[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
  onAddRequest: (parentId: string | null) => void;
}

function BlockList({ nodes, selectedId, onSelect, onMoveUp, onMoveDown, onDelete, onAddRequest }: BlockListProps): React.JSX.Element {
  return (
    <ul className="amoris-block-tree">
      {nodes.map((node, index) => {
        const isFirst = index === 0;
        const isLast = index === nodes.length - 1;
        return (
          <li key={node.id}>
            <div
              className={[
                'amoris-block-tree__row',
                node.id === selectedId ? 'amoris-block-tree__row--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <button type="button" className="amoris-focusable amoris-block-tree__label" onClick={() => onSelect(node.id)}>
                <span className="amoris-block-tree__type">{TYPE_LABEL[node.type]}</span> — {node.label}
              </button>
              <div className="amoris-block-tree__actions">
                <IconButton icon={<span aria-hidden="true">↑</span>} label={`Sposta su: ${node.label}`} onClick={() => onMoveUp(node.id)} disabled={isFirst} />
                <IconButton icon={<span aria-hidden="true">↓</span>} label={`Sposta giù: ${node.label}`} onClick={() => onMoveDown(node.id)} disabled={isLast} />
                <IconButton icon={<span aria-hidden="true">🗑</span>} label={`Elimina: ${node.label}`} onClick={() => onDelete(node.id)} />
              </div>
            </div>
            {node.children ? (
              <ul className="amoris-block-tree__children">
                <BlockList
                  nodes={node.children}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onDelete={onDelete}
                  onAddRequest={onAddRequest}
                />
                <li>
                  <Button variant="tertiary" onClick={() => onAddRequest(node.id)}>
                    Aggiungi blocco in «{node.label}»
                  </Button>
                </li>
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Componente 41: editor dell'albero dei blocchi. Aggiunge, sposta, elimina e
 * annida blocchi dentro una colonna con **comandi espliciti** — bottoni «Sposta
 * su» e «Sposta giù» — mai con il trascinamento (ADR-006 §3.2, vincolo di
 * prodotto sul trascinamento).
 */
export function BlockTreeEditor({
  blocks,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAddRequest,
  loading = false,
  errorText,
  emptyText = 'Questa colonna non contiene ancora blocchi.',
}: BlockTreeEditorProps): React.JSX.Element {
  if (errorText) {
    return (
      <p className="amoris-block-tree__status" role="alert">
        {errorText}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="amoris-block-tree__status">
        <Spinner label="Caricamento dei blocchi in corso…" />
      </div>
    );
  }

  return (
    <div>
      {blocks.length === 0 ? (
        <p className="amoris-block-tree__status">{emptyText}</p>
      ) : (
        <BlockList
          nodes={blocks}
          selectedId={selectedId}
          onSelect={onSelect}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
          onAddRequest={onAddRequest}
        />
      )}
      <Button variant="secondary" onClick={() => onAddRequest(null)}>
        Aggiungi blocco
      </Button>
    </div>
  );
}
