import { z } from 'zod';

/** Gli schemi delle richieste e risposte stanno in `@amoris/contracts`: qui solo il parametro di percorso. */
export {
  accountListSchema,
  createAccountBodySchema,
  createAccountResponseSchema,
  passwordResetResponseSchema,
  updateAccountBodySchema,
  updateAccountResponseSchema,
} from '@amoris/contracts';

export const idParam = z.object({ id: z.string().uuid() });
