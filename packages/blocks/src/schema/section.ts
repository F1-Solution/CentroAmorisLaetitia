/** `section` — contenitore. Può contenere solo `row` (`BLOCK-MODEL.md` §3.1). */
import { z } from 'zod';
import {
  classesField,
  ColorValue,
  CustomWidth,
  defaultCustomWidth,
  EntityRef,
  emptySpacing,
  Spacing,
} from '../common';

export const sectionPropsSchema = z
  .object({
    fullWidth: z.boolean().default(false),
    transparentBackground: z.boolean().default(false),
    backgroundColor: ColorValue.nullable().default(null),
    backgroundMediaId: EntityRef.nullable().default(null),
    parallax: z.boolean().default(false),
    innerShadow: z.boolean().default(false),
    customWidth: CustomWidth.default(defaultCustomWidth),
    padding: Spacing.default(emptySpacing),
    classes: classesField,
  })
  .strict();

export type SectionProps = z.infer<typeof sectionPropsSchema>;
