/**
 * I 14 tipi di blocco di `.planning/phases/1D/BLOCK-MODEL.md` §3. L'insieme è
 * **chiuso** in Fase 1 (ADR-006 §3.2, componente 42): non si allarga qui.
 */
export type BlockType =
  | 'section'
  | 'row'
  | 'column'
  | 'rich_text'
  | 'image'
  | 'media_text'
  | 'video'
  | 'map'
  | 'separator'
  | 'form'
  | 'post_list'
  | 'document'
  | 'slider'
  | 'html';

export interface BlockTypeOption {
  type: BlockType;
  /** Etichetta in italiano per l'inseritore di blocchi. */
  label: string;
}

/**
 * Etichette in italiano dei tipi di contenuto inseribili dentro una colonna
 * (BLOCK-MODEL.md §3.15): i contenitori `section`, `row`, `column` non si
 * inseriscono da `BlockInserter`, si ottengono dalla struttura della pagina.
 */
export const insertableBlockTypes: BlockTypeOption[] = [
  { type: 'rich_text', label: 'Testo' },
  { type: 'image', label: 'Immagine' },
  { type: 'media_text', label: 'Media e testo' },
  { type: 'video', label: 'Video' },
  { type: 'map', label: 'Mappa' },
  { type: 'separator', label: 'Separatore' },
  { type: 'form', label: 'Modulo' },
  { type: 'post_list', label: 'Elenco di contenuti' },
  { type: 'document', label: 'Documento' },
  { type: 'slider', label: 'Presentazione a scorrimento' },
  { type: 'html', label: 'Blocco HTML (riserva)' },
];
