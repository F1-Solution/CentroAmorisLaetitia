import { z } from 'zod';

/** Gli schemi delle richieste e risposte stanno in `@amoris/contracts`: qui solo il parametro di percorso. */
export {
  accountListSchema,
  createAccountBodySchema,
  createAccountResponseSchema,
  passwordResetBodySchema,
  passwordResetResponseSchema,
  updateAccountBodySchema,
  updateAccountResponseSchema,
} from '@amoris/contracts';

/** Id in minuscolo: il confronto con l'account della sessione non si aggira con le maiuscole (DR-288). */
export const idParam = z.object({ id: z.string().uuid().toLowerCase() });
