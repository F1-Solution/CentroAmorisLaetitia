/**
 * Sblocca un account bloccato per troppi tentativi: azzera il conteggio di quell'account e lascia una riga
 * di registro. In locale l'indirizzo arriva dalla variabile d'ambiente, mai dagli argomenti:
 *
 *     ACCOUNT_EMAIL=... pnpm --filter @amoris/api account:unblock
 *
 * Sul server (database `db`) servono `--ambiente` uguale ad AMORIS_ENV e `--conferma`, e l'indirizzo è l'unica riga di stdin:
 *
 *     docker compose ... run --rm --no-deps -T api node bin/account-unblock.js --ambiente production --conferma < ~/indirizzo.txt
 */
import { createDatabase } from '@amoris/db';
import { readTargetEmail } from '../src/accounts/localAccount.js';
import { unblockAccount } from '../src/auth/loginAttempts.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig(process.env as Record<string, string | undefined>);
const { db, close } = createDatabase({ url: config.DATABASE_URL, maxConnections: 1 });

try {
  const email = await readTargetEmail(
    config.DATABASE_URL,
    process.argv.slice(2),
    process.env,
    process.stdin,
    process.stdin.isTTY === true,
    'ACCOUNT_EMAIL manca: serve l’indirizzo dell’account da sbloccare',
  );
  const cleared = await unblockAccount(db, config, email);
  console.error(`Account sbloccato: ${cleared} fallimenti azzerati. Operazione registrata.`);
} catch (error) {
  console.error('Account non sbloccato:', error instanceof Error ? error.message : 'errore inatteso');
  process.exitCode = 1;
} finally {
  process.stdin.destroy();
  await close();
}
