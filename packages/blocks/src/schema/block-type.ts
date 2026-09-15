/**
 * L'insieme dei blocchi: chiuso a 14 tipi (ADR-005 §3.2, `BLOCK-MODEL.md` §2.5).
 */

export const CONTAINER_BLOCK_TYPES = ['section', 'row', 'column', 'media_text'] as const;
export type ContainerBlockType = (typeof CONTAINER_BLOCK_TYPES)[number];

export const CONTENT_BLOCK_TYPES = [
  'rich_text',
  'image',
  'media_text',
  'video',
  'map',
  'separator',
  'form',
  'post_list',
  'document',
  'slider',
  'html',
] as const;
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];

export const BLOCK_TYPES = [
  'section',
  'row',
  'column',
  'rich_text',
  'image',
  'media_text',
  'video',
  'map',
  'separator',
  'form',
  'post_list',
  'document',
  'slider',
  'html',
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Che cosa può contenere ogni tipo (`BLOCK-MODEL.md` §3.15). `media_text` sta
 * in entrambi gli insiemi (§2.5): contenitore per la struttura, blocco di
 * contenuto per la collocazione.
 */
export const ALLOWED_CHILDREN: Readonly<Record<BlockType, readonly BlockType[]>> = {
  section: ['row'],
  row: ['column'],
  column: CONTENT_BLOCK_TYPES,
  media_text: CONTENT_BLOCK_TYPES.filter((t) => t !== 'media_text'),
  rich_text: [],
  image: [],
  video: [],
  map: [],
  separator: [],
  form: [],
  post_list: [],
  document: [],
  slider: [],
  html: [],
};

/** La radice del documento accetta `section`, `row` e i blocchi di contenuto; non `column` (§1, regola 5). */
export const ROOT_ALLOWED_TYPES: readonly BlockType[] = ['section', 'row', ...CONTENT_BLOCK_TYPES];
