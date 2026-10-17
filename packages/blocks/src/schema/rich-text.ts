/**
 * `rich_text` — il blocco di lavoro. Non contiene blocchi (`BLOCK-MODEL.md`
 * §3.4). Vincolo Zod: `html` deve essere un punto fisso della sanificazione.
 */
import { z } from 'zod';
import { classesField, ColorValue, CssLength, emptySpacing, Spacing } from '../common';
import { isSanitizedFixedPoint } from '../sanitize/sanitize';

const borderSchema = z
  .object({
    color: ColorValue,
    width: CssLength,
    style: z.literal('solid'),
  })
  .strict();

export const richTextPropsSchema = z
  .object({
    html: z.string().min(1).refine(isSanitizedFixedPoint, {
      message: 'html deve essere un punto fisso della sanificazione (BLOCK-MODEL.md §3.4)',
    }),
    textAlign: z.enum(['left', 'center', 'right', 'justify']).nullable().default(null),
    backgroundLayout: z.enum(['light', 'dark']).nullable().default(null),
    border: borderSchema.nullable().default(null),
    padding: Spacing.default(emptySpacing),
    /** `custom_margin` di Divi (R, DR-157). */
    margin: Spacing.default(emptySpacing),
    classes: classesField,
  })
  .strict();

export type RichTextProps = z.infer<typeof richTextPropsSchema>;
