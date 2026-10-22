import { z } from 'zod';
import { lastChangeSchema } from './audit.js';

/**
 * Categorie e loro assegnazione alle notizie (wave 1G-W4): la voce dell'elenco con il
 * numero di notizie, il corpo e la risposta di `PUT /contents/:id/terms`.
 */

export const categorySchema = z.object({
  id: z.string(),
  taxonomy: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parentId: z.string().nullable(),
  position: z.number().int(),
  path: z.string(),
  /** Notizie legate alla categoria, in qualunque stato. */
  contentCount: z.number().int(),
});

/** Le categorie complete di una notizia; l'elenco vuoto è ammesso solo per una bozza (D141-A). */
export const contentTermsBodySchema = z.object({
  termIds: z.array(z.string().uuid()).max(100),
});

export const contentTermsResponseSchema = z.object({
  termIds: z.array(z.string()),
  lastChange: lastChangeSchema,
});

export type Category = z.infer<typeof categorySchema>;
export type ContentTermsBody = z.infer<typeof contentTermsBodySchema>;
export type ContentTermsResponse = z.infer<typeof contentTermsResponseSchema>;
