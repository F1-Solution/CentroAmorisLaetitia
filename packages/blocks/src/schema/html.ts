/**
 * `html` — il blocco di riserva. Non contiene blocchi (`BLOCK-MODEL.md` §3.14).
 * `html` non passa dal sanificatore del §5: solo il §3.14.2 si applica
 * (`stripDangerousMarkup`), ed è compito del convertitore, non dello schema.
 */
import { z } from 'zod';
import { classesField } from '../common.js';

export const HTML_BLOCK_REASONS = [
  'wp_html_block',
  'divi_unmapped_module',
  'divi_unmapped_markup',
  'shortcode_unknown',
  'manual',
] as const;
export type HtmlBlockReason = (typeof HTML_BLOCK_REASONS)[number];

export const htmlPropsSchema = z
  .object({
    html: z.string().min(1),
    reason: z.enum(HTML_BLOCK_REASONS),
    /** Nome del costrutto non rappresentato, mai il suo contenuto. Max 200 caratteri. */
    detail: z.string().max(200).nullable().default(null),
    classes: classesField,
  })
  .strict();

export type HtmlProps = z.infer<typeof htmlPropsSchema>;
