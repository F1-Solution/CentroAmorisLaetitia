import { categorySchema } from '@amoris/contracts';
import { z } from 'zod';
import { slugSchema } from '../content/schemas.js';

/** Un termine con il numero di contenuti legati: per le tassonomie diverse da `category` conta comunque i legami. */
export const termSchema = categorySchema;

export const listQuery = z.object({ taxonomy: z.string().min(1).max(50).optional() });

const termFields = z.object({
  taxonomy: z.string().min(1).max(50),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9._~%!$&()*+,;=:@-]+$/, 'lo slug contiene caratteri non ammessi nel percorso'),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().optional(),
});

/** Per una categoria lo slug segue la regola dei contenuti (DR-240). */
export const createBody = termFields.superRefine((body, ctx) => {
  if (body.taxonomy !== 'category') return;
  const parsed = slugSchema.safeParse(body.slug);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({ code: 'custom', path: ['slug'], message: issue.message });
  }
});

export const updateBody = termFields.partial().omit({ taxonomy: true });
export const idParam = z.object({ id: z.string().uuid() });

/** La SEO dell'archivio di una categoria, come All in One SEO la dava ai termini (DR-280). */
export const termSeoSchema = z.object({
  termId: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  robotsNoindex: z.boolean(),
  robotsNofollow: z.boolean(),
  updatedAt: z.string().nullable(),
});

export const termSeoBody = z.object({
  title: z.string().max(500).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  robotsNoindex: z.boolean().optional(),
  robotsNofollow: z.boolean().optional(),
});

/** Nomi in italiano dei campi, per il registro delle operazioni: mai i valori. */
const TERM_SEO_LABELS: readonly (readonly [keyof z.infer<typeof termSeoBody>, string])[] = [
  ['title', 'Titolo SEO'],
  ['description', 'Descrizione'],
  ['robotsNoindex', 'Non indicizzare'],
  ['robotsNofollow', 'Non seguire i collegamenti'],
];

export function termSeoFieldLabels(body: z.infer<typeof termSeoBody>): string[] {
  return TERM_SEO_LABELS.filter(([key]) => body[key] !== undefined).map(([, label]) => label);
}

const TERM_FIELD_LABELS: readonly (readonly [keyof z.infer<typeof updateBody>, string])[] = [
  ['name', 'Nome'],
  ['description', 'Descrizione'],
  ['parentId', 'Categoria genitrice'],
];

export function termFieldLabels(body: z.infer<typeof updateBody>): string[] {
  return TERM_FIELD_LABELS.filter(([key]) => body[key] !== undefined).map(([, label]) => label);
}

/** Che cosa impedisce di eliminare una categoria; le regole di redirect verso l'archivio restano. */
export const termDeletionSchema = z.object({
  blocked: z.boolean(),
  contentCount: z.number().int(),
  children: z.array(z.object({ id: z.string(), name: z.string(), path: z.string() })),
  menuItems: z.array(z.object({ id: z.string(), label: z.string(), menu: z.string() })),
  redirectsToPath: z.array(z.object({ source: z.string() })),
});

/** La risposta della modifica: gli avvisi D132-A dello spostamento, vuoti se l'indirizzo non cambia. */
export const termUpdateResponse = termSchema.extend({
  warnings: z.array(
    z.object({ kind: z.enum(['canonical', 'menu']), id: z.string(), value: z.string() }),
  ),
});
