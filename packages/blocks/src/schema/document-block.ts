/**
 * `document` — riferimento a un documento scaricabile. Non contiene blocchi
 * (`BLOCK-MODEL.md` §3.12). Nome del file scelto per non collidere con
 * `BlockDocument`, l'involucro dell'intero documento a blocchi (§1).
 */
import { z } from 'zod';
import { classesField, EntityRef } from '../common';

export const docBlockPropsSchema = z
  .object({
    documentId: EntityRef,
    label: z.string().nullable().default(null),
    display: z.enum(['link', 'button', 'card']).default('link'),
    classes: classesField,
  })
  .strict();

export type DocBlockProps = z.infer<typeof docBlockPropsSchema>;
