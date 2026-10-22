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
