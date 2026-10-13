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
    /** Quanti articoli saltare dall'inizio dell'ordinamento (DR-116, `offset` di `[catposts]`). */
    offset: z.number().int().min(0).default(0),
    showThumbnail: z.boolean().default(true),
    showDate: z.boolean().default(true),
    showExcerpt: z.boolean().default(true),
    order: z.enum(['date_desc', 'date_asc', 'title_asc']).default('date_desc'),
    /** Miniatura alla misura del plugin della sorgente (`thumb_w`/`thumb_h`). */
    thumbnailWidth: z.number().int().min(1).max(2000).nullable().optional(),
    thumbnailHeight: z.number().int().min(1).max(2000).nullable().optional(),
    /** Parole dell'estratto generato dal testo (`excerpt_length`); il servizio lo taglia. */
    excerptWords: z.number().int().min(1).max(1000).nullable().optional(),
    /** Link dopo un estratto tagliato (`excerpt_more_text`). */
    excerptMoreText: z.string().max(100).nullable().optional(),
    /** Miniatura per gli articoli senza immagine in evidenza (`default_thunmbnail`). */
    defaultThumbnailMediaId: EntityRef.nullable().optional(),
    classes: classesField,
  })
  .strict();

export type PostListProps = z.infer<typeof postListPropsSchema>;
