/**
 * Applica le migrazioni. È un **passo esplicito**, mai qualcosa che accade
 * all'avvio di un'applicazione: ADR-009 §4.4 lo vieta, perché un servizio che
 * migra all'avvio, riavviato più volte, migra in parallelo.
 *
 * Su un database di produzione questo comando va preceduto da un backup e da
 * una conferma puntuale dell'utente (`CLAUDE.md`).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL non è impostata. Copia .env.example in .env e riprova.');
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });

try {
  const started = Date.now();
  await migrate(drizzle(client), { migrationsFolder });
  console.error(`Migrazioni applicate in ${Date.now() - started} ms.`);
} catch (error) {
  console.error('Migrazione fallita:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
