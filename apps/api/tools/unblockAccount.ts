/**
 * Sblocca un account bloccato per troppi tentativi: azzera il conteggio di quell'account e lascia una riga
 * di registro. L'indirizzo arriva dalla variabile d'ambiente, mai dagli argomenti:
 *
 *     ACCOUNT_EMAIL=... pnpm --filter @amoris/api account:unblock
 */
import { createDatabase } from '@amoris/db';
import { unblockAccount } from '../src/auth/loginAttempts.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig(process.env as Record<string, string | undefined>);
const { db, close } = createDatabase({ url: config.DATABASE_URL, maxConnections: 1 });

try {
  const email = process.env.ACCOUNT_EMAIL?.trim();
  if (!email) throw new Error('ACCOUNT_EMAIL manca: serve l’indirizzo dell’account da sbloccare');
  const cleared = await unblockAccount(db, config, email);
  console.error(`Account sbloccato: ${cleared} fallimenti azzerati. Operazione registrata.`);
} catch (error) {
  console.error('Account non sbloccato:', error instanceof Error ? error.message : 'errore inatteso');
  process.exitCode = 1;
} finally {
  await close();
}
