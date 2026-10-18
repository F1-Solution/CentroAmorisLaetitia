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

/**
 * Forma del valore per le chiavi che il sito pubblico legge come dati
 * dell'organizzazione (DR-185); le altre chiavi restano libere come prima.
 */
export const SETTING_VALUE_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  'contact.address': z.string().max(500).nullable(),
  'contact.phone': z.string().max(50),
  // Solo http e https: `url()` accetterebbe anche `javascript:` e `data:`.
  'social.profiles': z
    .array(
      z
        .string()
        .url()
        .max(500)
        .regex(/^https?:\/\//i),
    )
    .max(20),
};

export const updateBody = z.object({
  value: z.unknown(),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});
