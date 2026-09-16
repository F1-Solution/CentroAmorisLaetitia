import { z } from 'zod';

export const loginBody = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(1024),
});

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z
    .string()
    .min(12, 'la nuova password è troppo corta: almeno 12 caratteri')
    .max(1024),
});

export const currentUser = z.object({
  userId: z.string(),
  email: z.string(),
  fullName: z.string(),
  mustChangePassword: z.boolean(),
  permissions: z.array(z.string()),
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
