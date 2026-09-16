import { z } from 'zod';

export const settingSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  label: z.string(),
  description: z.string().nullable(),
  isSecret: z.boolean(),
  updatedAt: z.string(),
});

export const keyParam = z.object({ key: z.string().min(1).max(200) });

export const updateBody = z.object({
  value: z.unknown(),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});
