import { Alert } from '../primitives/Alert';
import './RichTextToolbar.css';

/**
 * Comandi ammessi dallo schema di ADR-005 §3.5: **niente `h1`** (appartiene al
 * template) e **niente stile in linea** (ADR-006 §3.1).
 */
export type RichTextCommand =
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'bulletList'
  | 'orderedList'
  | 'link'
  | 'image'
  | 'table';

const COMMAND_LABEL: Record<RichTextCommand, string> = {
  h2: 'Titolo 2',
  h3: 'Titolo 3',
  h4: 'Titolo 4',
  h5: 'Titolo 5',
  h6: 'Titolo 6',
  bold: 'Grassetto',
  italic: 'Corsivo',
  underline: 'Sottolineato',
  strike: 'Barrato',
  bulletList: 'Elenco puntato',
  orderedList: 'Elenco numerato',
  link: 'Collegamento',
  image: 'Immagine',
  table: 'Tabella',
};

const ALL_COMMANDS: RichTextCommand[] = [
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'bold',
  'italic',
  'underline',
  'strike',
  'bulletList',
  'orderedList',
  'link',
  'image',
  'table',
];

export interface RichTextToolbarProps {
  onCommand: (command: RichTextCommand) => void;
  /** Comandi che corrispondono alla formattazione nel punto corrente del cursore. */
  activeCommands?: RichTextCommand[];
  disabledCommands?: RichTextCommand[];
  /**
   * Presente quando un incollaggio non ammesso è stato rifiutato: l'avviso è
   * **visibile**, mai un ripulimento silenzioso (ADR-006 §3.1).
   */
  pasteRejectedText?: string;
}

/**
 * Componente 44: barra degli strumenti del testo ricco. Solo i comandi che
 * corrispondono agli elementi ammessi da ADR-005 §3.5: `h1` assente, stile in
 * linea assente.
 */
export function RichTextToolbar({
  onCommand,
  activeCommands = [],
  disabledCommands = [],
  pasteRejectedText,
}: RichTextToolbarProps): React.JSX.Element {
  return (
    <div className="amoris-rich-text-toolbar" role="toolbar" aria-label="Formattazione del testo">
      {ALL_COMMANDS.map((command) => {
        const isActive = activeCommands.includes(command);
        const isDisabled = disabledCommands.includes(command);
        return (
          <button
            key={command}
            type="button"
            className="amoris-focusable amoris-rich-text-toolbar__button"
            aria-pressed={isActive}
            aria-label={COMMAND_LABEL[command]}
            title={COMMAND_LABEL[command]}
            onClick={() => onCommand(command)}
            disabled={isDisabled}
          >
            {COMMAND_LABEL[command]}
          </button>
        );
      })}
      {pasteRejectedText ? (
        <div className="amoris-rich-text-toolbar__paste-warning">
          <Alert variant="warning" title="Incollaggio non ammesso">
            {pasteRejectedText}
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
