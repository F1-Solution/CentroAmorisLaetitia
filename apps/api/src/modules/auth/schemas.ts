import { z } from 'zod';
import { ADMIN_AREAS } from '../../auth/areas.js';

export const loginBody = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(1024),
});

export const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1).max(1024),
    newPassword: z
      .string()
      .min(12, 'la nuova password è troppo corta: almeno 12 caratteri')
      .max(1024),
  })
  // Una password temporanea non si «cambia» con sé stessa: resterebbe nota a chi l'ha reimpostata (DR-228).
  .refine((body) => body.newPassword !== body.currentPassword, {
    message: 'la nuova password deve essere diversa da quella attuale',
    path: ['newPassword'],
  });

/** Una veste offerta dal commutatore: un ruolo posseduto e le sue aree. */
export const roleHeld = z.object({
  roleId: z.string(),
  key: z.string(),
  label: z.string(),
  areas: z.array(z.enum(ADMIN_AREAS)),
});

export const currentUser = z.object({
  userId: z.string(),
  email: z.string(),
  fullName: z.string(),
  mustChangePassword: z.boolean(),
  /** I permessi del **ruolo attivo**. Vuoti finche' la veste non e' scelta. */
  permissions: z.array(z.string()),
  activeRoleId: z.string().nullable(),
  activeArea: z.enum(ADMIN_AREAS).nullable(),
  rolesHeld: z.array(roleHeld),
});

export const chooseContextBody = z.object({
  roleId: z.string().uuid(),
  area: z.enum(ADMIN_AREAS),
});

export const sessionSummary = z.object({
  id: z.string(),
  issuedAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string(),
  userAgent: z.string().nullable(),
  current: z.boolean(),
});

export const revokedCount = z.object({ revoked: z.number().int() });
export const acknowledged = z.object({ ok: z.literal(true) });
