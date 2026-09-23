import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

/**
 * ADR-002: Drizzle con drizzle-kit per le migrazioni.
 * `casing: 'snake_case'` attua DR-036 per convenzione.
 *
 * Le migrazioni generate si **leggono prima di applicarle**: e' una regola,
 * non una buona abitudine (ADR-002 §5).
 *
 * Il `.env` si carica qui e non da un argomento del comando, come fanno gli
 * altri script del pacchetto: `drizzle-kit` e' un eseguibile suo e non inoltra
 * i flag di Node, e `NODE_OPTIONS` rifiuta `--env-file-if-exists`. Questo resta
 * un file di configurazione di uno strumento, non codice che gira in
 * produzione, e la distinzione e' il motivo per cui il servizio invece il
 * `.env` non lo cerca affatto.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, '..', '..', '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

/**
 * Nessun indirizzo di ripiego. Fino al 2026-09-23 ce n'era uno scritto qui:
 * con `DATABASE_URL` assente o diversa, `drizzle-kit` generava le migrazioni
 * confrontandole con un altro database **senza dirlo**. Un comando che si
 * rifiuta di partire e' sempre preferibile a uno che lavora sulla cosa
 * sbagliata in silenzio.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL non è impostata. Copia .env.example in .env e riprova.\n' +
      'Le migrazioni si generano confrontando lo schema con un database vero: ' +
      'senza indirizzo non c’è confronto da fare.',
  );
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
