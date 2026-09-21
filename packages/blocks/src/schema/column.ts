/**
 * `column` — contenitore. Può contenere i blocchi di contenuto (`BLOCK-MODEL.md`
 * §3.3). L'insieme chiuso dei valori di `width` non è ancora misurato
 * (assunzione vietata 2 di `BLOCK-MODEL.md` §9): resta un'espressione
 * regolare finché `1D-W3` non lo enumera.
 */
import { z } from 'zod';
import { classesField, emptySpacing, Spacing } from '../common';

export const columnPropsSchema = z
  .object({
    width: z.string().regex(/^\d+_\d+$/),
    padding: Spacing.default(emptySpacing),
    classes: classesField,
  })
  .strict();

export type ColumnProps = z.infer<typeof columnPropsSchema>;
