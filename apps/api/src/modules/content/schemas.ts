import { lastChangeSchema } from '@amoris/contracts';
import { blockDocumentSchema } from '@amoris/blocks/model';
import { z } from 'zod';

/** Schemi del modulo `content`. Sorgente unica di validazione, tipi e OpenAPI. */

export const contentTypeSchema = z.enum(['page', 'post']);
export const contentStatusSchema = z.enum(['draft', 'published', 'archived']);

/**
 * Il documento a blocchi è validato dagli schemi di `packages/blocks`, che sono
 * la sola autorità su ADR-005 §3.1: qui non se ne riscrive una copia.
 *
 * **Fino al 2026-09-23 questa frase era un'intenzione, non un fatto** (DR-079).
 * La forma dichiarata si fermava a «un numero e un elenco di cose», e nessuno
 * guardava dentro le cose: un documento con proprietà inesistenti entrava a
 * database e l'editor poi si rifiutava di aprirlo. L'unico posto che validava
 * era l'editor, cioè dopo.
 *
 * La forma esterna resta questa, perché è quella che finisce nella specifica
 * OpenAPI e che i 14 tipi ricorsivi renderebbero illeggibile. La validazione
 * vera si aggiunge sopra, e i suoi errori arrivano al client con il percorso
 * del blocco che non va.
 */
export const blockDocument = z
  .object({
    schema: z.number().int(),
    blocks: z.array(z.unknown()),
  })
  .superRefine((value, ctx) => {
    const esito = blockDocumentSchema.safeParse(value);
    if (esito.success) return;
    for (const problema of esito.error.issues) {
      ctx.addIssue({ code: 'custom', path: problema.path, message: problema.message });
    }
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

/** Layout della pagina, ex `_et_pb_page_layout` (DR-139). */
export const pageLayoutSchema = z.enum(['right_sidebar', 'full_width', 'no_sidebar']);

export const contentDetail = contentSummary.extend({
  showTitle: z.boolean(),
  pageLayout: pageLayoutSchema,
  isSticky: z.boolean(),
  excerpt: z.string().nullable(),
  blocks: blockDocument,
  contentHtml: z.string(),
  featuredMediaId: z.string().nullable(),
  legacyFormat: z.string().nullable(),
});

/** Solo la lettura di un contenuto porta l'ultima modifica (D127). */
export const contentDetailWithChange = contentDetail.extend({ lastChange: lastChangeSchema });

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
  pageLayout: pageLayoutSchema.optional(),
  blocks: blockDocument.optional(),
});

/** Il titolo vuoto è ammesso solo se il contenuto lo ha già vuoto (DR-201): lo verifica il servizio. */
export const updateBody = createBody.partial().extend({
  title: z.string().max(500).optional(),
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
  title: z.string().max(500),
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
