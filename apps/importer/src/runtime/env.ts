/**
 * Caricamento esplicito di `.env`: si cerca il file risalendo dalla cartella
 * corrente fino a trovare `pnpm-workspace.yaml`, che segna la radice del
 * monorepo.
 *
 * Serve perché l'importer si avvia anche da dentro una sottocartella, dove un
 * percorso relativo fisso non reggerebbe. Gli altri comandi del repository —
 * `db:migrate`, `db:verify`, `db:seed`, `dev` e `start` del servizio — non
 * passano di qui: hanno una radice nota e usano `--env-file-if-exists` nello
 * script, così il `.env` resta una comodità del comando e il codice che gira in
 * produzione non va a cercare sul disco un file che lì non deve esistere.
 *
 * **Fino al 2026-09-23 quei comandi non caricavano affatto il `.env`** e
 * fallivano tutti e cinque; questo commento ne descriveva il difetto come
 * aperto. Ora è chiuso, e `packages/db/tests/env-loading.test.ts` impedisce che
 * si riapra.
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
