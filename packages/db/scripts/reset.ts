/**
 * Ricrea da zero il database indicato da `DATABASE_URL` e vi applica le
 * migrazioni. Serve alle prove end-to-end (`tests/e2e/global-setup.ts`), che
 * hanno bisogno di partire ogni volta dallo **stesso** stato: un database
 * riusato porta dentro ciò che l'esecuzione precedente ha lasciato, e una
 * prova che dipende da ciò che c'era prima non prova niente.
 *
 * **Cancella un database intero.** Per questo si rifiuta di eseguire con
 * `NODE_ENV=production` e con un nome che non dichiari di essere usa e getta:
 * `CLAUDE.md` mette le cancellazioni fra le azioni a conferma obbligatoria, e
 * l'unico modo per lasciarlo automatico è renderlo incapace di toccare
 * qualcosa che non sia un ambiente di prova.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL non è impostata: non c’è alcun database da ricreare.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('Questo comando non si esegue con NODE_ENV=production.');
  process.exit(1);
}

const parsed = new URL(url);
const nome = parsed.pathname.replace(/^\//, '');
if (!/_e2e$|_test$|^amoris_e2e$/.test(nome)) {
  console.error(
    `Rifiuto di ricreare il database "${nome}": questo comando accetta solo nomi che finiscono ` +
      'per `_e2e` o `_test`, perché cancella tutto quello che c’è dentro.',
  );
  process.exit(1);
}

const admin = postgres(
  (() => {
    const amministrativo = new URL(url);
    amministrativo.pathname = '/postgres';
    return amministrativo.toString();
  })(),
  { max: 1, onnotice: () => {} },
);

let client: ReturnType<typeof postgres> | null = null;

try {
  await admin.unsafe(`drop database if exists "${nome}" with (force)`);
  await admin.unsafe(`create database "${nome}"`);

  client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder });
  console.error(`Database "${nome}" ricreato e migrato.`);
} catch (error) {
  console.error('Ricreazione fallita:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client?.end({ timeout: 5 });
  await admin.end({ timeout: 5 });
}
