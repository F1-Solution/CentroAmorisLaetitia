import { z } from 'zod';

export const menuSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
});

export const menuItemSchema = z.object({
  id: z.string(),
  menuId: z.string(),
  parentId: z.string().nullable(),
  position: z.number().int(),
  kind: z.enum(['content', 'term', 'custom']),
  label: z.string(),
  contentId: z.string().nullable(),
  termId: z.string().nullable(),
  url: z.string().nullable(),
  linkTarget: z.string().nullable(),
  cssClasses: z.string().nullable(),
  visibility: z.enum(['public', 'authenticated', 'roles', 'hidden']),
  visibleToRoles: z.array(z.string()),
});

/**
 * Il vincolo `menu_items_target_matches_kind` dello schema pretende che il
 * bersaglio corrisponda al tipo. Lo si riafferma qui perché la richiesta venga
 * respinta con un messaggio comprensibile invece che con un errore del database.
 */
const base = z.object({
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
  label: z.string().min(1).max(200),
  linkTarget: z.string().max(20).nullable().optional(),
  cssClasses: z.string().max(200).nullable().optional(),
  visibility: z.enum(['public', 'authenticated', 'roles', 'hidden']).optional(),
  visibleToRoles: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export const createItemBody = z.discriminatedUnion('kind', [
  base.extend({ kind: z.literal('content'), contentId: z.string().uuid() }),
  base.extend({ kind: z.literal('term'), termId: z.string().uuid() }),
  base.extend({ kind: z.literal('custom'), url: z.string().min(1).max(2000) }),
]);

export const updateItemBody = z.object({
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
  label: z.string().min(1).max(200).optional(),
  linkTarget: z.string().max(20).nullable().optional(),
  cssClasses: z.string().max(200).nullable().optional(),
  visibility: z.enum(['public', 'authenticated', 'roles', 'hidden']).optional(),
  visibleToRoles: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export const keyParam = z.object({ key: z.string().min(1).max(100) });
export const idParam = z.object({ id: z.string().uuid() });
