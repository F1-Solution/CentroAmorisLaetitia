import { z } from 'zod';

export const roleSchema = z.object({
  key: z.string(),
  label: z.string(),
});
