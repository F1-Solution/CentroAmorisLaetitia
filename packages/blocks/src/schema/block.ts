/**
 * Un blocco ha esattamente quattro chiavi (`BLOCK-MODEL.md` §1): `type`, `id`,
 * `props`, `children`. Qui l'unione discriminata dei 14 tipi, con `children`
 * ricorsivo. Il contenimento (chi può stare dentro chi) si verifica a livello
 * di documento, in `containment.ts`: qui lo schema accetta qualunque figlio di
 * qualunque tipo, perché Zod da solo non esprime «figlio ammesso in base al
 * tipo del genitore» senza perdere la forma dell'unione discriminata.
 */
import { z } from 'zod';
import { BlockId } from '../common.js';
import { sectionPropsSchema, type SectionProps } from './section.js';
import { rowPropsSchema, type RowProps } from './row.js';
import { columnPropsSchema, type ColumnProps } from './column.js';
import { richTextPropsSchema, type RichTextProps } from './rich-text.js';
import { imagePropsSchema, type ImageProps } from './image.js';
import { mediaTextPropsSchema, type MediaTextProps } from './media-text.js';
import { videoPropsSchema, type VideoProps } from './video.js';
import { mapPropsSchema, type MapProps } from './map.js';
import { separatorPropsSchema, type SeparatorProps } from './separator.js';
import { formPropsSchema, type FormProps } from './form.js';
import { postListPropsSchema, type PostListProps } from './post-list.js';
import { docBlockPropsSchema, type DocBlockProps } from './document-block.js';
import { sliderPropsSchema, type SliderProps } from './slider.js';
import { htmlPropsSchema, type HtmlProps } from './html.js';

export interface SectionBlock {
  type: 'section';
  id: string;
  props: SectionProps;
  children: BlockNode[];
}
export interface RowBlock {
  type: 'row';
  id: string;
  props: RowProps;
  children: BlockNode[];
}
export interface ColumnBlock {
  type: 'column';
  id: string;
  props: ColumnProps;
  children: BlockNode[];
}
export interface RichTextBlock {
  type: 'rich_text';
  id: string;
  props: RichTextProps;
  children: BlockNode[];
}
export interface ImageBlock {
  type: 'image';
  id: string;
  props: ImageProps;
  children: BlockNode[];
}
export interface MediaTextBlock {
  type: 'media_text';
  id: string;
  props: MediaTextProps;
  children: BlockNode[];
}
export interface VideoBlock {
  type: 'video';
  id: string;
  props: VideoProps;
  children: BlockNode[];
}
export interface MapBlock {
  type: 'map';
  id: string;
  props: MapProps;
  children: BlockNode[];
}
export interface SeparatorBlock {
  type: 'separator';
  id: string;
  props: SeparatorProps;
  children: BlockNode[];
}
export interface FormBlock {
  type: 'form';
  id: string;
  props: FormProps;
  children: BlockNode[];
}
export interface PostListBlock {
  type: 'post_list';
  id: string;
  props: PostListProps;
  children: BlockNode[];
}
export interface DocBlockNode {
  type: 'document';
  id: string;
  props: DocBlockProps;
  children: BlockNode[];
}
export interface SliderBlock {
  type: 'slider';
  id: string;
  props: SliderProps;
  children: BlockNode[];
}
export interface HtmlBlock {
  type: 'html';
  id: string;
  props: HtmlProps;
  children: BlockNode[];
}

export type BlockNode =
  | SectionBlock
  | RowBlock
  | ColumnBlock
  | RichTextBlock
  | ImageBlock
  | MediaTextBlock
  | VideoBlock
  | MapBlock
  | SeparatorBlock
  | FormBlock
  | PostListBlock
  | DocBlockNode
  | SliderBlock
  | HtmlBlock;

export const blockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('section'),
      id: BlockId,
      props: sectionPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('row'),
      id: BlockId,
      props: rowPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('column'),
      id: BlockId,
      props: columnPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('rich_text'),
      id: BlockId,
      props: richTextPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('image'),
      id: BlockId,
      props: imagePropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('media_text'),
      id: BlockId,
      props: mediaTextPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('video'),
      id: BlockId,
      props: videoPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('map'),
      id: BlockId,
      props: mapPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('separator'),
      id: BlockId,
      props: separatorPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('form'),
      id: BlockId,
      props: formPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('post_list'),
      id: BlockId,
      props: postListPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('document'),
      id: BlockId,
      props: docBlockPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('slider'),
      id: BlockId,
      props: sliderPropsSchema,
      children: z.array(blockNodeSchema),
    }),
    z.object({
      type: z.literal('html'),
      id: BlockId,
      props: htmlPropsSchema,
      children: z.array(blockNodeSchema),
    }),
  ]),
);

export * from './block-type.js';
export * from './section.js';
export * from './row.js';
export * from './column.js';
export * from './rich-text.js';
export * from './image.js';
export * from './media-text.js';
export * from './video.js';
export * from './map.js';
export * from './separator.js';
export * from './form.js';
export * from './post-list.js';
export * from './document-block.js';
export * from './slider.js';
export * from './html.js';
