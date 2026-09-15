/**
 * Caricamento esplicito di `.env`. `packages/db/scripts/migrate.ts` non lo fa, e
 * `pnpm db:migrate` fallisce per questo se non passa da `--env-file` a mano.
 * L'importer lo carica da sé: si cerca `.env` risalendo dalla cartella corrente
 * fino a trovare `pnpm-workspace.yaml`, che segna la radice del monorepo.
 *
 * Se `.env` non esiste (per esempio in CI, dove le variabili arrivano già
 * dall'ambiente) si prosegue senza errore: la validazione della configurazione,
 * subito dopo, dirà se manca qualcosa di obbligatorio.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

export function findMonorepoRoot(from: string): string | null {
  let dir = from;
  for (;;) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadDotEnv(startDir: string = process.cwd()): void {
  const root = findMonorepoRoot(startDir);
  if (!root) return;
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return;
  process.loadEnvFile(envPath);
}
