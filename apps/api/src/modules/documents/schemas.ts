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

const titleField = z
  .string()
  .trim()
  .min(1, 'Il titolo è obbligatorio.')
  .max(300, 'Il titolo può avere al massimo 300 caratteri.');

const descriptionField = z
  .string()
  .trim()
  .max(5000, 'La descrizione può avere al massimo 5000 caratteri.')
  .nullable()
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value));

/** Creazione (DR-281): il PDF è già nella libreria, caricato con `POST /media`; mai un riservato. */
export const createBody = z
  .object({
    title: titleField,
    description: descriptionField,
    termId: z.string().uuid(),
    mediaId: z.string().uuid(),
  })
  .strict();

/** Che cosa trattiene l'eliminazione e che cosa resta dopo (DR-281). */
export const deletionPreviewSchema = z.object({
  blocked: z.boolean(),
  /** Contenuti con un blocco «Documento» che lo cita. */
  contents: z.array(z.object({ id: z.string(), title: z.string(), path: z.string() })),
  /** Voci di menu che portano a `/download/<slug>/`. */
  menuItems: z.array(z.object({ id: z.string(), label: z.string(), menu: z.string() })),
  /** Regole di redirect verso la scheda: restano, e porteranno a «pagina non trovata». */
  redirectsToPath: z.array(z.object({ source: z.string() })),
  /** Vero se il file è usato altrove e quindi resta nell'archivio. */
  fileShared: z.boolean(),
});
