import { z } from 'zod';

/** Schemi del modulo `content`. Sorgente unica di validazione, tipi e OpenAPI. */

export const contentTypeSchema = z.enum(['page', 'post']);
export const contentStatusSchema = z.enum(['draft', 'published', 'archived']);

/**
 * Il documento a blocchi è validato dagli schemi di `packages/blocks`, che sono
 * la sola autorità su ADR-005 §3.1: qui non se ne riscrive una copia.
 */
export const blockDocument = z.object({
  schema: z.number().int(),
  blocks: z.array(z.unknown()),
});

export const listQuery = z.object({
  type: contentTypeSchema.optional(),
  status: contentStatusSchema.optional(),
  search: z.string().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const contentSummary = z.object({
  id: z.string(),
  type: contentTypeSchema,
  status: contentStatusSchema,
  slug: z.string(),
  path: z.string(),
  title: z.string(),
  position: z.number().int(),
  parentId: z.string().nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const contentDetail = contentSummary.extend({
  showTitle: z.boolean(),
  isSticky: z.boolean(),
  excerpt: z.string().nullable(),
  blocks: blockDocument,
  contentHtml: z.string(),
  featuredMediaId: z.string().nullable(),
  legacyFormat: z.string().nullable(),
});

export const listResponse = z.object({
  items: z.array(contentSummary),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    perPage: z.number().int(),
  }),
});

export const createBody = z.object({
  type: contentTypeSchema,
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9._~%!$&()*+,;=:@-]+$/, 'lo slug contiene caratteri non ammessi nel percorso'),
  title: z.string().min(1).max(500),
  parentId: z.string().uuid().nullable().optional(),
  excerpt: z.string().max(5000).nullable().optional(),
  showTitle: z.boolean().optional(),
  blocks: blockDocument.optional(),
});

export const updateBody = createBody.partial().extend({
  isSticky: z.boolean().optional(),
  featuredMediaId: z.string().uuid().nullable().optional(),
  contentHtml: z.string().optional(),
  contentText: z.string().optional(),
});

export const idParam = z.object({ id: z.string().uuid() });

/**
 * Copie di lavoro (DR-068). L'editor vi salva da solo; il contenuto pubblicato
 * cambia solo su comando. `baseUpdatedAt` e' il `updatedAt` del contenuto
 * quando la copia e' stata aperta: se non coincide piu', il contenuto e'
 * cambiato sotto e pubblicare la copia sovrascriverebbe il lavoro di un altro.
 */
export const draftBody = z.object({
  title: z.string().min(1).max(500),
  excerpt: z.string().max(5000).nullable().optional(),
  blocks: blockDocument,
  baseUpdatedAt: z.string(),
});

export const draftDetail = z.object({
  contentId: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  blocks: blockDocument,
  baseUpdatedAt: z.string(),
  updatedAt: z.string(),
  /** Falso quando il contenuto e' cambiato dopo l'apertura della copia. */
  stillCurrent: z.boolean(),
});
