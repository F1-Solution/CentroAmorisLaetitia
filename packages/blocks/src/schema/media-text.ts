/**
 * `media_text` — contenitore per la struttura, blocco di contenuto per la
 * collocazione (`BLOCK-MODEL.md` §3.6). Non può contenere sé stesso.
 */
import { z } from 'zod';
import { classesField, EntityRef } from '../common';

export const mediaTextPropsSchema = z
  .object({
    mediaId: EntityRef.nullable().default(null),
    mediaAlt: z.string().default(''),
    mediaVariant: z
      .string()
      .regex(/^\d+x\d+$/)
      .nullable()
      .default(null),
    mediaPosition: z.enum(['left', 'right']).default('left'),
    mediaWidthPercent: z.number().int().min(1).max(99).nullable().default(null),
    verticalAlignment: z.enum(['top', 'center', 'bottom']).default('center'),
    linkUrl: z.string().nullable().default(null),
    classes: classesField,
  })
  .strict();

export type MediaTextProps = z.infer<typeof mediaTextPropsSchema>;
