import { z } from 'zod';

export const termSchema = z.object({
  id: z.string(),
  taxonomy: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parentId: z.string().nullable(),
  position: z.number().int(),
  path: z.string(),
});

export const listQuery = z.object({ taxonomy: z.string().min(1).max(50).optional() });

export const createBody = z.object({
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

export const updateBody = createBody.partial().omit({ taxonomy: true });
export const idParam = z.object({ id: z.string().uuid() });
