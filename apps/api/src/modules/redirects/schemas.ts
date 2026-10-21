import { z } from 'zod';

const path = z.string().min(1).max(2000).startsWith('/', 'il percorso deve iniziare con una barra');

/** La destinazione resta sul sito: `//host` e `/\host` il browser li legge come un altro sito (D137-A, DR-241). */
const targetPath = path
  .refine(
    (value) => !/^\/[/\\]/.test(value),
    'la destinazione non può iniziare con «//» né con «/\\»: porterebbe fuori dal sito',
  )
  .refine(
    (value) => !/[\\\p{Cc}]/u.test(value),
    'la destinazione non può contenere «\\» né caratteri di controllo',
  );

export const redirectSchema = z.object({
  id: z.string(),
  sourcePath: z.string(),
  targetPath: z.string(),
  statusCode: z.number().int(),
  kind: z.enum(['exact', 'prefix']),
  origin: z.enum(['migration', 'manual', 'automatic']),
  isActive: z.boolean(),
  note: z.string().nullable(),
  hitCount: z.number().int(),
  lastHitAt: z.string().nullable(),
});

export const listQuery = z.object({
  active: z.enum(['true', 'false']).optional(),
  search: z.string().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

export const listResponse = z.object({
  items: z.array(redirectSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    perPage: z.number().int(),
  }),
});

export const createBody = z.object({
  sourcePath: path,
  targetPath,
  statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).optional(),
  kind: z.enum(['exact', 'prefix']).optional(),
  note: z.string().max(2000).nullable().optional(),
});

export const updateBody = createBody.partial().extend({ isActive: z.boolean().optional() });
export const idParam = z.object({ id: z.string().uuid() });
