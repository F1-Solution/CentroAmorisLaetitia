/**
 * `form`. Non contiene blocchi (`BLOCK-MODEL.md` §3.10). Il blocco non
 * contiene la definizione dei campi: quella sta in `forms` (ADR-010 §4.1).
 */
import { z } from 'zod';
import { classesField, EntityRef } from '../common';

export const formPropsSchema = z
  .object({
    formId: EntityRef,
    origin: z.enum(['wpforms', 'divi']),
    showTitle: z.boolean().default(false),
    showDescription: z.boolean().default(false),
    classes: classesField,
  })
  .strict();

export type FormProps = z.infer<typeof formPropsSchema>;
