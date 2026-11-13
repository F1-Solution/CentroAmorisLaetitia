/**
 * Crea un account sul database **locale**, o sul servizio `db` di un ambiente con
 * conferma esplicita (R24). Non crea ruoli né permessi (ADR-007 §3.2), non
 * sovrascrive un account esistente, e senza password la genera (DR-228).
 */
import { schema, type Database } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { writeAudit } from '../auth/audit.js';
import type { Config } from '../config.js';
import { generateTemporaryPassword, hashPassword } from '../lib/password.js';

export const MIN_PASSWORD_LENGTH = 12;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export class LocalAccountError extends Error {}

export interface LocalAccountInput {
  readonly email: string;
  readonly fullName: string;
  /** Assente: si genera una password temporanea da cambiare al primo accesso. */
  readonly password?: string | undefined;
  readonly roleKey: string;
}

export interface LocalAccountResult {
  readonly userId: string;
  readonly email: string;
  readonly roleKey: string;
  /** Presente solo se generata: va mostrata una volta e mai registrata. */
  readonly temporaryPassword?: string;
}

const inputSchema = z.object({
  ACCOUNT_EMAIL: z.email(),
  ACCOUNT_NAME: z.string().trim().min(1),
  ACCOUNT_PASSWORD: z.string().min(MIN_PASSWORD_LENGTH).optional(),
  ACCOUNT_ROLE: z.string().trim().min(1),
});

/** Legge i dati dalle variabili d'ambiente; un errore nomina la variabile, mai il suo valore. */
export function parseLocalAccountInput(
  env: Readonly<Record<string, string | undefined>>,
  fieldLabels: Readonly<Record<string, string>> = {},
): LocalAccountInput {
  const parsed = inputSchema.safeParse(env);
  if (!parsed.success) {
    const fields = [
      ...new Set(
        parsed.error.issues.map((issue) => {
          const key = String(issue.path[0]);
          return fieldLabels[key] ?? key;
        }),
      ),
    ];
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

/** Sul server indirizzo e nome arrivano da due righe di stdin, così non restano in cronologia né nel journal (DR-426). */
export function parseServerAccountInput(
  stdinText: string,
  env: Readonly<Record<string, string | undefined>>,
): LocalAccountInput {
  assertAccountIdentityNotInEnv(env);
  const lines = stdinText.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  if (lines.length !== 2) {
    throw new LocalAccountError(
      'stdin deve contenere esattamente due righe: prima l’indirizzo, poi il nome',
    );
  }
  return parseLocalAccountInput(
    {
      ACCOUNT_EMAIL: lines[0]!.trim(),
      ACCOUNT_NAME: lines[1]!.trim(),
      ACCOUNT_ROLE: env.ACCOUNT_ROLE,
    },
    { ACCOUNT_EMAIL: 'indirizzo', ACCOUNT_NAME: 'nome' },
  );
}

/** Sul server indirizzo e nome non si passano dall'ambiente: il rifiuto precede la lettura di stdin e non riporta i valori. */
export function assertAccountIdentityNotInEnv(
  env: Readonly<Record<string, string | undefined>>,
): void {
  if (env.ACCOUNT_EMAIL !== undefined || env.ACCOUNT_NAME !== undefined) {
    throw new LocalAccountError(
      'sul server indirizzo e nome si passano da stdin, non con ACCOUNT_EMAIL o ACCOUNT_NAME',
    );
  }
}

/** Sul server l'indirizzo dell'account da sbloccare o reimpostare è l'unica riga non vuota di stdin. */
export function parseServerEmailInput(stdinText: string): string {
  const lines = stdinText.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  if (lines.length !== 1 || lines[0]!.trim() === '') {
    throw new LocalAccountError('stdin deve contenere una sola riga: l’indirizzo dell’account');
  }
  return lines[0]!.trim();
}

/** Indirizzo dell'account su cui agire: da stdin sul server (host `db`), da ACCOUNT_EMAIL altrove, come prima. */
export async function readTargetEmail(
  databaseUrl: string,
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  stdin: AsyncIterable<Uint8Array | string>,
  isTerminal: boolean,
  missingMessage: string,
): Promise<string> {
  if (new URL(databaseUrl).hostname === 'db') {
    assertServerFlags(parseServerFlags(argv), env);
    if (env.ACCOUNT_EMAIL !== undefined) {
      throw new LocalAccountError(
        'sul server l’indirizzo si passa da stdin, non con ACCOUNT_EMAIL',
      );
    }
    return parseServerEmailInput(await readServerInput(stdin, { isTerminal }));
  }
  const email = env.ACCOUNT_EMAIL?.trim();
  if (!email) throw new LocalAccountError(missingMessage);
  return email;
}

export interface ServerInputOptions {
  readonly isTerminal?: boolean;
  readonly maxBytes?: number;
  readonly timeoutMs?: number;
}

/** Legge stdin con limite di dimensione e scadenza; un terminale non è ammesso. */
export async function readServerInput(
  stream: AsyncIterable<Uint8Array | string>,
  options: ServerInputOptions = {},
): Promise<string> {
  const { isTerminal = false, maxBytes = 4096, timeoutMs = 30_000 } = options;
  if (isTerminal) {
    throw new LocalAccountError('stdin è un terminale: passa indirizzo e nome da file o da pipe');
  }
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new LocalAccountError('stdin: dati non arrivati entro il tempo massimo')),
      timeoutMs,
    );
  });
  const read = (async () => {
    const parts: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
      const part = Buffer.from(chunk);
      size += part.length;
      if (size > maxBytes) throw new LocalAccountError('stdin: dati oltre il limite ammesso');
      parts.push(part);
    }
    return Buffer.concat(parts).toString('utf8');
  })();
  read.catch(() => undefined);
  try {
    return await Promise.race([read, expired]);
  } finally {
    clearTimeout(timer);
  }
}

export type AccountMode = 'local' | 'server';

const SERVER_ENVIRONMENTS = new Set(['production', 'staging']);

interface ServerFlags {
  readonly ambiente: string | undefined;
  readonly confirmed: boolean;
}

/** Legge `--ambiente <valore>` e `--conferma`; ogni altro argomento è un errore. */
function parseServerFlags(argv: readonly string[]): ServerFlags {
  let ambiente: string | undefined;
  let confirmed = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--conferma') confirmed = true;
    else if (arg === '--ambiente' && i + 1 < argv.length) ambiente = argv[(i += 1)];
    else throw new LocalAccountError(`argomento sconosciuto o incompleto: ${String(arg)}`);
  }
  return { ambiente, confirmed };
}

/** Sul server servono l'ambiente coincidente con AMORIS_ENV e la conferma. */
function assertServerFlags(
  { ambiente, confirmed }: ServerFlags,
  env: Readonly<Record<string, string | undefined>>,
): void {
  if (!ambiente || !SERVER_ENVIRONMENTS.has(ambiente) || ambiente !== env.AMORIS_ENV) {
    throw new LocalAccountError(
      'sul server serve --ambiente <production|staging> uguale all’ambiente in cui gira il contenitore',
    );
  }
  if (!confirmed) throw new LocalAccountError('sul server serve anche --conferma');
}

/** Valida la riga di comando e l'host: modo server solo con `db`, ambiente coincidente e conferma; nulla si scrive prima. */
export function resolveAccountMode(
  databaseUrl: string,
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): AccountMode {
  const flags = parseServerFlags(argv);
  const host = new URL(databaseUrl).hostname;
  if (host !== 'db') {
    assertLocalDatabase(databaseUrl);
    return 'local';
  }
  assertServerFlags(flags, env);
  if (env.ACCOUNT_PASSWORD !== undefined) {
    throw new LocalAccountError(
      'sul server ACCOUNT_PASSWORD non è ammessa: la password temporanea si genera da sola',
    );
  }
  return 'server';
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
  const temporaryPassword = input.password === undefined ? generateTemporaryPassword() : undefined;
  const passwordHash = await hashPassword(input.password ?? temporaryPassword!, config);
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
      .values({
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        mustChangePassword: temporaryPassword !== undefined,
      })
      .returning({ id: schema.users.id });
    if (!user) throw new LocalAccountError('account non creato');
    await tx.insert(schema.userRoles).values({ userId: user.id, roleId: role.id });
    // Da riga di comando non c'è un attore: la riga porta solo origine e ruolo (DR-421).
    await writeAudit(tx, {
      action: 'account.create',
      entityType: 'account',
      entityId: user.id,
      detail: { source: 'cli', roleKey: input.roleKey },
    });

    return {
      userId: user.id,
      email: input.email,
      roleKey: input.roleKey,
      ...(temporaryPassword === undefined ? {} : { temporaryPassword }),
    };
  });
}
