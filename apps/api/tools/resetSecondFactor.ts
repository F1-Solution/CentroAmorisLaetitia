/**
 * Toglie il secondo fattore di un account (telefono perso) e chiude le sue sessioni: al prossimo accesso
 * la persona lo attiva di nuovo. L'indirizzo arriva dalla variabile d'ambiente, mai dagli argomenti:
 *
 *     ACCOUNT_EMAIL=... pnpm --filter @amoris/api account:reset-totp
 */
import { createDatabase } from '@amoris/db';
import { resetSecondFactor } from '../src/auth/totp.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig(process.env as Record<string, string | undefined>);
const { db, close } = createDatabase({ url: config.DATABASE_URL, maxConnections: 1 });

try {
  const email = process.env.ACCOUNT_EMAIL?.trim();
  if (!email) throw new Error('ACCOUNT_EMAIL manca: serve l’indirizzo dell’account da reimpostare');
  const revoked = await resetSecondFactor(db, email);
  if (revoked === null) throw new Error('nessun account con questo indirizzo');
  console.error(`Secondo fattore reimpostato: ${revoked} sessioni chiuse. Operazione registrata.`);
} catch (error) {
  console.error(
    'Secondo fattore non reimpostato:',
    error instanceof Error ? error.message : 'errore inatteso',
  );
  process.exitCode = 1;
} finally {
  await close();
}
