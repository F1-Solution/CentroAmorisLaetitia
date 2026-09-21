/**
 * `post_list`. Non contiene blocchi (`BLOCK-MODEL.md` §3.11). I valori
 * predefiniti sono un'ipotesi dichiarata, da verificare sull'unica occorrenza
 * in `1D-W3` (assunzione vietata 3 di `BLOCK-MODEL.md` §9).
 */
import { z } from 'zod';
import { classesField, EntityRef } from '../common';

export const postListPropsSchema = z
  .object({
    termIds: z.array(EntityRef).default([]),
    limit: z.number().int().min(1).max(50).nullable().default(null),
    showThumbnail: z.boolean().default(true),
    showDate: z.boolean().default(true),
    showExcerpt: z.boolean().default(true),
    order: z.enum(['date_desc', 'date_asc', 'title_asc']).default('date_desc'),
    classes: classesField,
  })
  .strict();

export type PostListProps = z.infer<typeof postListPropsSchema>;
