/** `row` — contenitore. Può contenere solo `column` (`BLOCK-MODEL.md` §3.2). */
import { z } from 'zod';
import {
  ColorValue,
  CustomWidth,
  classesField,
  defaultCustomWidth,
  EntityRef,
  emptySpacing,
  Spacing,
} from '../common';

const gutterSchema = z
  .object({
    custom: z.boolean(),
    width: z.number().nullable(),
  })
  .strict();

export const defaultGutter = { custom: false, width: null } as const;

export const rowPropsSchema = z
  .object({
    /**
     * Obbligatoria. L'invariante con le colonne figlie — deve essere
     * esattamente l'unione, nell'ordine, dei `width` delle colonne figlie —
     * si verifica a livello di documento (`containment.ts`), perché è
     * un'invariante fra fratelli, non del solo nodo.
     */
    columnStructure: z.string().regex(/^\d+_\d+(,\d+_\d+)*$/),
    /** DR-134: `flex` per le righe nate da Gutenberg; assente per Divi. */
    layout: z.enum(['flex']).optional(),
    fullWidth: z.boolean().default(false),
    customWidth: CustomWidth.default(defaultCustomWidth),
    gutter: gutterSchema.default(defaultGutter),
    backgroundColor: ColorValue.nullable().default(null),
    backgroundMediaId: EntityRef.nullable().default(null),
    padding: Spacing.default(emptySpacing),
    /** `custom_margin` di Divi (R, DR-157). */
    margin: Spacing.default(emptySpacing),
    classes: classesField,
  })
  .strict();

export type RowProps = z.infer<typeof rowPropsSchema>;
