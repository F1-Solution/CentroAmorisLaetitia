import path from 'node:path';
import { z } from 'zod';

/**
 * Configurazione dell'importer, validata all'avvio (ADR-009 §4.3). Se manca o è
 * malformata una variabile obbligatoria, il programma **non parte** e dice quale:
 * lo stesso principio di `apps/api/src/config.ts`.
 */

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z
    .string({ error: 'manca, ed è obbligatoria: è l’indirizzo del database' })
    .min(1, 'è vuota: serve l’indirizzo del database'),

  S3_ENDPOINT: z
    .string({ error: 'manca, ed è obbligatoria: è l’indirizzo dello storage a oggetti' })
    .min(1),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string({ error: 'manca, ed è obbligatoria' }).min(1),
  S3_SECRET_KEY: z.string({ error: 'manca, ed è obbligatoria' }).min(1),
  S3_BUCKET_PUBLIC: z.string({ error: 'manca, ed è obbligatoria' }).min(1),
  S3_BUCKET_PRIVATE: z.string({ error: 'manca, ed è obbligatoria' }).min(1),

  /**
   * Percorso della sorgente congelata. Ha un valore predefinito che punta al
   * backup autorevole dichiarato in `IMPORTER-DESIGN.md`, sovrascrivibile per i
   * test che leggono una sorgente sintetica.
   */
  IMPORTER_DUMP_PATH: z
    .string()
    .min(1)
    .default('source-private/BackupDB-2026-09-13/Sql1138799_1.sql'),
  IMPORTER_UPLOADS_PATH: z
    .string()
    .min(1)
    .default('source-private/wordpress-2026-09-13/wp-content/uploads'),

  /** Albero riservato di Customer Area (DR-058): i 4 documenti riservati non stanno in `uploads/`. */
  IMPORTER_PRIVATE_STORAGE_PATH: z
    .string()
    .min(1)
    .default('source-private/wordpress-2026-09-13/wp-content/customer-area/storage'),

  /**
   * Sale per il digest di `form_submissions.ip_hash` e del campo IP di
   * `legacy_download_stats.payload` (fase `submissions`/`legacy`,
   * `importer-spec.md` §4). **Obbligatorio, senza valore predefinito**: un
   * sale prevedibile vanificherebbe l'anonimizzazione. Deve restare stabile
   * fra le esecuzioni, altrimenti lo stesso indirizzo produce digest diversi
   * a ogni riesecuzione.
   */
  IMPORTER_IP_HASH_SALT: z
    .string({ error: 'manca, ed è obbligatoria: è il sale per il digest degli indirizzi IP' })
    .min(1, 'è vuota: serve un sale non prevedibile'),
});

export type Config = z.infer<typeof configSchema>;

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

/** Risolve un percorso di configurazione contro la radice del monorepo, non contro `cwd`. */
export function resolveFromRoot(root: string, configuredPath: string): string {
  return path.isAbsolute(configuredPath) ? configuredPath : path.join(root, configuredPath);
}
