import { addressPlanSchema, lastChangeSchema } from '@amoris/contracts';
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

/** Spazio fra le colonne, ex `_et_pb_gutter_width`: da 1 a 4, `null` = valore del tema (DR-149, DR-278). */
const GUTTER_MESSAGE = {
  error: 'Lo spazio fra le colonne è un valore da 1 a 4, o vuoto per quello del tema.',
};
export const gutterWidthSchema = z
  .number(GUTTER_MESSAGE)
  .int(GUTTER_MESSAGE)
  .min(1, GUTTER_MESSAGE)
  .max(4, GUTTER_MESSAGE)
  .nullable();

export const contentDetail = contentSummary.extend({
  showTitle: z.boolean(),
  pageLayout: pageLayoutSchema,
  gutterWidth: gutterWidthSchema,
  isSticky: z.boolean(),
  excerpt: z.string().nullable(),
  blocks: blockDocument,
  contentHtml: z.string(),
  featuredMediaId: z.string().nullable(),
  legacyFormat: z.string().nullable(),
});

/**
 * Solo la lettura di un contenuto porta l'ultima modifica (D127), e se è la pagina
 * iniziale, che il sito serve a `/` qualunque sia il suo percorso (S3).
 */
export const contentDetailWithChange = contentDetail.extend({
  lastChange: lastChangeSchema,
  isHome: z.boolean(),
  /** Solo le categorie (S4): le altre tassonomie non si assegnano dal CMS. */
  termIds: z.array(z.string()),
  /** L'immagine in evidenza con la miniatura per l'anteprima; per un media senza varianti è l'originale. */
  featuredMedia: z
    .object({ id: z.string(), title: z.string().nullable(), thumbnailUrl: z.string() })
    .nullable(),
});

export const listResponse = z.object({
  items: z.array(contentSummary),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    perPage: z.number().int(),
  }),
});

/** Caratteri ammessi in un segmento del percorso; `%` solo come codifica completa (D136-A). */
const SLUG_PATTERN = /^(?:[a-z0-9._~!$&()*+,;=:@-]|%[0-9a-f]{2})+$/;

/** Lo slug decodificato; `null` se una codifica non corrisponde a un carattere. */
export function decodeSlug(slug: string): string | null {
  try {
    return decodeURIComponent(slug);
  } catch {
    return null;
  }
}

/** Perché lo slug, decodificato, non è un segmento che il sito possa servire (D136-A, DR-240). */
function decodedSlugProblem(slug: string): string | null {
  // Un carattere non ammesso lo segnala già l'espressione.
  if (!SLUG_PATTERN.test(slug)) return null;
  const decoded = decodeSlug(slug);
  if (decoded === null) return 'lo slug contiene una codifica che non corrisponde a un carattere';
  if (decoded === '.' || decoded === '..') {
    return 'lo slug non può essere «.» né «..», nemmeno codificati: il browser li toglie dall’indirizzo';
  }
  if (/[/\\]/.test(decoded)) return 'lo slug non può contenere barre, nemmeno codificate';
  if (/\p{Cc}/u.test(decoded)) return 'lo slug non può contenere caratteri di controllo';
  return null;
}

/** Un segmento del percorso: la stessa regola alla creazione e al cambio d'indirizzo. */
export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(SLUG_PATTERN, 'lo slug contiene caratteri non ammessi nel percorso')
  .superRefine((slug, ctx) => {
    const problem = decodedSlugProblem(slug);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

export const createBody = z.object({
  type: contentTypeSchema,
  slug: slugSchema,
  title: z.string().min(1).max(500),
  parentId: z.string().uuid().nullable().optional(),
  excerpt: z.string().max(5000).nullable().optional(),
  showTitle: z.boolean().optional(),
  pageLayout: pageLayoutSchema.optional(),
  blocks: blockDocument.optional(),
});

/**
 * Il titolo vuoto è ammesso solo se il contenuto lo ha già vuoto (DR-201): lo verifica il servizio.
 * Slug e genitore cambiano solo con `PUT /contents/:id/address`: una chiave in più è un 400.
 */
export const updateBody = createBody
  .omit({ slug: true, parentId: true })
  .partial()
  .extend({
    title: z.string().max(500).optional(),
    gutterWidth: gutterWidthSchema.optional(),
    isSticky: z.boolean().optional(),
    featuredMediaId: z.string().uuid().nullable().optional(),
    contentHtml: z.string().optional(),
    contentText: z.string().optional(),
  })
  .strict();

/** Nomi in italiano dei campi di una modifica, per il registro delle operazioni: mai i valori (DR-278). */
const UPDATE_FIELD_LABELS: readonly (readonly [keyof z.infer<typeof updateBody>, string])[] = [
  ['title', 'Titolo'],
  ['excerpt', 'Estratto'],
  ['showTitle', 'Mostrare il titolo'],
  ['pageLayout', 'Layout della pagina'],
  ['gutterWidth', 'Spazio fra le colonne'],
  ['isSticky', 'Notizia in primo piano'],
  ['featuredMediaId', 'Immagine in evidenza'],
  ['blocks', 'Contenuto'],
];

export function updateFieldLabels(body: z.infer<typeof updateBody>): string[] {
  return UPDATE_FIELD_LABELS.filter(([key]) => body[key] !== undefined).map(([, label]) => label);
}

export const idParam = z.object({ id: z.string().uuid() });

/** Categorie di una notizia (wave 1G-W4): corpo e risposta in `@amoris/contracts`. */
export { contentTermsBodySchema, contentTermsResponseSchema } from '@amoris/contracts';

/** Cambio d'indirizzo (wave 1G-W3): risposte in `@amoris/contracts`. */
export { addressOptionsSchema, addressPlanSchema } from '@amoris/contracts';

/** Anteprima: `parentId` assente o vuoto vuol dire primo livello. */
export const addressPreviewQuery = z.object({
  slug: slugSchema,
  parentId: z.union([z.literal(''), z.string().uuid()]).optional(),
});

/** L'indirizzo d'arrivo completo: `parentId` nullo vuol dire primo livello. */
export const addressChangeBody = z.object({
  slug: slugSchema,
  parentId: z.string().uuid().nullable(),
});

export const addressChangeResponse = z.object({
  content: contentDetailWithChange,
  plan: addressPlanSchema,
});

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
