/**
 * Tipi condivisi fra tutti i 14 blocchi. `BLOCK-MODEL.md` §2.
 */
import { z } from 'zod';

/** Identificatore stabile di un blocco. Generazione: `ids.ts`, §4. */
export const BlockId = z.string().regex(/^b_[0-9a-f]{12}$/);
export type BlockId = z.infer<typeof BlockId>;

/**
 * Riferimento a un'altra entità (media, form, documento, slider, termine): un
 * identificatore di riga di PostgreSQL, mai un identificatore di WordPress
 * (`BLOCK-MODEL.md` §2.3).
 */
export const EntityRef = z.string().uuid();
export type EntityRef = z.infer<typeof EntityRef>;

/** Cinque unità ammesse. Nessuna `calc()`, nessun valore multiplo (§2.4). */
export const CssLength = z.string().regex(/^-?\d+(\.\d+)?(px|em|rem|%|vh|vw)$/);
export type CssLength = z.infer<typeof CssLength>;

/**
 * Colore esadecimale o `rgb()`/`rgba()`, conservato nella forma della sorgente:
 * non si normalizza (§2.4, arbitrario e dichiarato).
 */
export const ColorValue = z
  .string()
  .regex(
    /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/,
  );
export type ColorValue = z.infer<typeof ColorValue>;

export const Box = z
  .object({
    top: CssLength.nullable(),
    right: CssLength.nullable(),
    bottom: CssLength.nullable(),
    left: CssLength.nullable(),
  })
  .strict();
export type Box = z.infer<typeof Box>;

export const emptyBox: Box = { top: null, right: null, bottom: null, left: null };

export const Spacing = z
  .object({
    base: Box.nullable(),
    tablet: Box.nullable(),
    phone: Box.nullable(),
  })
  .strict();
export type Spacing = z.infer<typeof Spacing>;

export const emptySpacing: Spacing = { base: null, tablet: null, phone: null };

/**
 * Larghezza personalizzata, condivisa da `section` e `row` (§3.1, §3.2).
 *
 * Vincolo Zod: se `mode` è `'default'` allora `value` è `null`; altrimenti
 * `value` è un numero positivo.
 */
export const CustomWidth = z
  .object({
    mode: z.enum(['default', 'px', 'percent']),
    value: z.number().positive().nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.mode === 'default' && v.value !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: "value deve essere null quando mode è 'default'",
      });
    }
    if (v.mode !== 'default' && v.value === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: "value deve essere un numero positivo quando mode non è 'default'",
      });
    }
  });
export type CustomWidth = z.infer<typeof CustomWidth>;

export const defaultCustomWidth: CustomWidth = { mode: 'default', value: null };

/**
 * Vocabolario chiuso delle classi dichiarate (`BLOCK-MODEL.md` §7.2). Una classe
 * fuori da questo elenco fa fallire la validazione: non è uno spazio libero.
 */
export const ALLOWED_CLASSES = [
  'is-fullwidth',
  'has-parallax',
  'has-inner-shadow',
  'has-transparent-bg',
  'text-light',
  'text-dark',
  'align-left',
  'align-center',
  'align-right',
  'align-justify',
  'center-on-mobile',
  'in-lightbox',
  'map-grayscale',
] as const;
export type AllowedClass = (typeof ALLOWED_CLASSES)[number];

export const ClassName = z.enum(ALLOWED_CLASSES);

/** Il frammento `classes` che ogni tipo di blocco include (§1, regola 4; §2.1). */
export const classesField = z.array(ClassName).default([]);
