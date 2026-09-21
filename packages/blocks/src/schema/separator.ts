/** `separator`. Non contiene blocchi (`BLOCK-MODEL.md` §3.9). */
import { z } from 'zod';
import { classesField } from '../common';

export const separatorPropsSchema = z
  .object({
    style: z.enum(['default', 'wide', 'dots']).default('default'),
    classes: classesField,
  })
  .strict();

export type SeparatorProps = z.infer<typeof separatorPropsSchema>;
