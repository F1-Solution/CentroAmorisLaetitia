import { z } from 'zod';

/**
 * Schemi delle rotte `/accounts` (wave 1G-W1, «Persone e permessi»): l'API li usa
 * per validare e documentare, l'area amministrativa per i tipi.
 */

/** Ruoli che l'amministrazione può assegnare (DR-229). */
export const ACCOUNT_ROLE_KEYS = ['editor', 'amministrazione'] as const;

export const accountRoleKeySchema = z.enum(ACCOUNT_ROLE_KEYS);

/** Indirizzo normalizzato: senza spazi ai lati e in minuscolo, come lo confronta `citext`. */
const emailSchema = z.string().trim().toLowerCase().max(320).pipe(z.email('indirizzo non valido'));

const roleKeysSchema = z
  .array(accountRoleKeySchema)
  .min(1, 'serve almeno un ruolo')
  .max(ACCOUNT_ROLE_KEYS.length);

/** Un account come lo vede l'amministrazione: mai l'hash della password. */
export const accountSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  isActive: z.boolean(),
  roleKeys: z.array(z.string()),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});

export const accountListSchema = z.object({ items: z.array(accountSchema) });

export const createAccountBodySchema = z.strictObject({
  email: emailSchema,
  fullName: z.string().trim().min(1).max(200),
  roleKeys: roleKeysSchema,
});

/** Password attuale, richiesta solo sul proprio account (DR-288); vuota vale assente. */
const currentPasswordSchema = z.string().max(1024).optional();

export const updateAccountBodySchema = z
  .strictObject({
    fullName: z.string().trim().min(1).max(200).optional(),
    email: emailSchema.optional(),
    roleKeys: roleKeysSchema.optional(),
    isActive: z.boolean().optional(),
    currentPassword: currentPasswordSchema,
  })
  .refine(
    (body) => Object.keys(body).some((key) => key !== 'currentPassword'),
    'nessuna modifica richiesta',
  );

/** Corpo facoltativo della reimpostazione: la password attuale serve solo per la propria (DR-288). */
export const passwordResetBodySchema = z
  .strictObject({ currentPassword: currentPasswordSchema })
  .nullish();

/** L'unica risposta, con quella di reimpostazione, che porta una password (DR-228). */
export const createAccountResponseSchema = z.object({
  account: accountSchema,
  temporaryPassword: z.string(),
});

export const updateAccountResponseSchema = z.object({ account: accountSchema });

export const passwordResetResponseSchema = z.object({ temporaryPassword: z.string() });

export type AccountRoleKey = z.infer<typeof accountRoleKeySchema>;
export type Account = z.infer<typeof accountSchema>;
export type AccountList = z.infer<typeof accountListSchema>;
export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;
export type CreateAccountResponse = z.infer<typeof createAccountResponseSchema>;
export type UpdateAccountResponse = z.infer<typeof updateAccountResponseSchema>;
export type PasswordResetBody = z.infer<typeof passwordResetBodySchema>;
export type PasswordResetResponse = z.infer<typeof passwordResetResponseSchema>;
