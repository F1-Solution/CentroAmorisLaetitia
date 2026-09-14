import { z } from 'zod';

/**
 * Configurazione del servizio, letta dalle variabili d'ambiente e validata
 * all'avvio (ADR-009 §4.3).
 *
 * Se manca o è malformata una variabile obbligatoria il servizio **non parte** e
 * dice quale: un servizio che parte con una configurazione incompleta e fallisce
 * più tardi è molto più difficile da diagnosticare.
 */

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  /** Unica variabile senza valore predefinito: senza database non c'è servizio. */
  DATABASE_URL: z
    .string({ error: 'manca, ed è obbligatoria: è l’indirizzo del database' })
    .min(1, 'è vuota: serve l’indirizzo del database'),
  /** Origini ammesse, separate da virgole. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
});

export type Config = z.infer<typeof configSchema>;

/** Errore di configurazione. Porta con sé l'elenco delle variabili che non vanno. */
export class ConfigError extends Error {
  constructor(public readonly problems: readonly string[]) {
    super(`Configurazione non valida:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(sconosciuta)';
    return `${name}: ${issue.message}`;
  });
  throw new ConfigError(problems);
}
