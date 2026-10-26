import { z } from 'zod';

/** Documenti scaricabili nell'area Redazione (S1): titolo e descrizione sono testo, mai HTML. */

export const idParam = z.object({ id: z.string().uuid() });

export const documentSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  publishedAt: z.string().nullable(),
  modifiedAt: z.string().nullable(),
  sitePath: z.string(),
  file: z.object({
    mediaId: z.string().uuid(),
    fileName: z.string(),
    mimeType: z.string(),
    byteSize: z.number().int().nonnegative(),
    publicPath: z.string(),
  }),
});

/** Almeno un campo; una descrizione vuota o di soli spazi vale `null`. */
export const updateBody = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Il titolo è obbligatorio.')
      .max(300, 'Il titolo può avere al massimo 300 caratteri.')
      .optional(),
    description: z
      .string()
      .trim()
      .max(5000, 'La descrizione può avere al massimo 5000 caratteri.')
      .nullable()
      .optional()
      .transform((value) => (value === '' ? null : value)),
  })
  .refine((body) => body.title !== undefined || body.description !== undefined, {
    message: 'Indica almeno un campo da modificare.',
  });
