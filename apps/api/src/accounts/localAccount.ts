/**
 * Crea un account sul database **locale** quando nessuno può entrare: l'unico
 * utente importato non ha password, e il seme sintetico non scrive su un
 * database importato. Non crea ruoli né permessi (ADR-007 §3.2), non
 * sovrascrive un account esistente, e non riporta mai la password.
 */
import { schema, type Database } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Config } from '../config.js';
import { hashPassword } from '../lib/password.js';

export const MIN_PASSWORD_LENGTH = 12;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export class LocalAccountError extends Error {}

export interface LocalAccountInput {
  readonly email: string;
  readonly fullName: string;
  readonly password: string;
  readonly roleKey: string;
}

export interface LocalAccountResult {
  readonly userId: string;
  readonly email: string;
  readonly roleKey: string;
}

const inputSchema = z.object({
  ACCOUNT_EMAIL: z.email(),
  ACCOUNT_NAME: z.string().trim().min(1),
  ACCOUNT_PASSWORD: z.string().min(MIN_PASSWORD_LENGTH),
  ACCOUNT_ROLE: z.string().trim().min(1),
});

/** Legge i dati dalle variabili d'ambiente; un errore nomina la variabile, mai il suo valore. */
export function parseLocalAccountInput(
  env: Readonly<Record<string, string | undefined>>,
): LocalAccountInput {
  const parsed = inputSchema.safeParse(env);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new LocalAccountError(
      `variabili mancanti o non valide: ${fields.join(', ')} (la password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri)`,
    );
  }
  return {
    email: parsed.data.ACCOUNT_EMAIL,
    fullName: parsed.data.ACCOUNT_NAME,
    password: parsed.data.ACCOUNT_PASSWORD,
    roleKey: parsed.data.ACCOUNT_ROLE,
  };
}

/** Solo un database su questa macchina: lo strumento non tocca mai un ambiente remoto. */
export function assertLocalDatabase(databaseUrl: string): void {
  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new LocalAccountError(`il database non è su questa macchina (${host}): mi rifiuto`);
  }
}

export async function createLocalAccount(
  db: Database,
  config: Config,
  input: LocalAccountInput,
): Promise<LocalAccountResult> {
  const passwordHash = await hashPassword(input.password, config);
  return db.transaction(async (tx) => {
    const [role] = await tx
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.key, input.roleKey));
    if (!role) {
      throw new LocalAccountError(
        `il ruolo «${input.roleKey}» non esiste, e lo strumento non crea ruoli (ADR-007)`,
      );
    }

    const [existing] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, input.email));
    if (existing) {
      throw new LocalAccountError('esiste già un account con questo indirizzo: non lo sovrascrivo');
    }

    const [user] = await tx
      .insert(schema.users)
      .values({ email: input.email, fullName: input.fullName, passwordHash })
      .returning({ id: schema.users.id });
    if (!user) throw new LocalAccountError('account non creato');
    await tx.insert(schema.userRoles).values({ userId: user.id, roleId: role.id });

    return { userId: user.id, email: input.email, roleKey: input.roleKey };
  });
}
