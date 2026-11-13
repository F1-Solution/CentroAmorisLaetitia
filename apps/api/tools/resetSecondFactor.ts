/**
 * Toglie il secondo fattore di un account (telefono perso) e chiude le sue sessioni: al prossimo accesso
 * la persona lo attiva di nuovo. In locale l'indirizzo arriva dalla variabile d'ambiente, mai dagli argomenti:
 *
 *     ACCOUNT_EMAIL=... pnpm --filter @amoris/api account:reset-totp
 *
 * Sul server (database `db`) servono `--ambiente` uguale ad AMORIS_ENV e `--conferma`, e l'indirizzo è l'unica riga di stdin:
 *
 *     docker compose ... run --rm --no-deps -T api node bin/account-reset-totp.js --ambiente production --conferma < ~/indirizzo.txt
 */
import { createDatabase } from '@amoris/db';
import { readTargetEmail } from '../src/accounts/localAccount.js';
import { resetSecondFactor } from '../src/auth/totp.js';
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
    'ACCOUNT_EMAIL manca: serve l’indirizzo dell’account da reimpostare',
  );
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
  process.stdin.destroy();
  await close();
}
