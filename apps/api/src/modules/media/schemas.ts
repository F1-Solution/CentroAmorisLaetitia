import { z } from 'zod';

export const mediaSchema = z.object({
  id: z.string(),
  storageKey: z.string(),
  publicPath: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  byteSize: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  title: z.string().nullable(),
  altText: z.string().nullable(),
  caption: z.string().nullable(),
  description: z.string().nullable(),
  isPrivate: z.boolean(),
  uploadedAt: z.string(),
});

/** Dopo il caricamento: il media e quante dimensioni derivate sono nate. */
export const uploadResponse = mediaSchema.extend({ derivatives: z.number().int() });

/** Dopo la sostituzione: il media e le derivate scritte e tolte. */
export const replaceResponse = mediaSchema.extend({
  derivatives: z.object({ written: z.number().int(), removed: z.number().int() }),
});

export const listQuery = z.object({
  search: z.string().min(1).max(200).optional(),
  mimePrefix: z.string().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const listResponse = z.object({
  items: z.array(mediaSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    perPage: z.number().int(),
  }),
});

/** Testo alternativo e didascalia: quello che il criterio 1D-31 chiede di modificare. */
export const updateBody = z.object({
  title: z.string().max(500).nullable().optional(),
  altText: z.string().max(1000).nullable().optional(),
  caption: z.string().max(2000).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
});

export const idParam = z.object({ id: z.string().uuid() });
