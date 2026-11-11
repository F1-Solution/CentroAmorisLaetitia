/**
 * Crea un account per l'area amministrativa. In locale i dati arrivano dalle variabili d'ambiente
 * (con ACCOUNT_PASSWORD, oppure senza: password generata, mostrata una volta, da cambiare):
 *
 *     ACCOUNT_EMAIL=... ACCOUNT_NAME=... ACCOUNT_PASSWORD=... ACCOUNT_ROLE=editor \
 *       pnpm --filter @amoris/api account:create
 *
 * Sul server (database `db`, mai ACCOUNT_PASSWORD, la password generata è l'unica riga di stdout)
 * indirizzo e nome sono le due righe di stdin, da un file con permessi 600 reindirizzato con `<`:
 *
 *     docker compose ... run --rm --no-deps -T -e ACCOUNT_ROLE=editor api node bin/account-create.js --ambiente production --conferma < ~/primo-account.txt
 */
import { createDatabase } from '@amoris/db';
import { loadConfig } from '../src/config.js';
import {
  createLocalAccount,
  LocalAccountError,
  parseLocalAccountInput,
  parseServerAccountInput,
  readServerInput,
  resolveAccountMode,
} from '../src/accounts/localAccount.js';

const config = loadConfig(process.env as Record<string, string | undefined>);
const { db, close } = createDatabase({ url: config.DATABASE_URL, maxConnections: 1 });

try {
  const mode = resolveAccountMode(config.DATABASE_URL, process.argv.slice(2), process.env);
  const input =
    mode === 'server'
      ? parseServerAccountInput(
          await readServerInput(process.stdin, { isTerminal: process.stdin.isTTY === true }),
          process.env,
        )
      : parseLocalAccountInput(process.env);
  const result = await createLocalAccount(db, config, input);
  console.error(
    `Account creato: ${result.email}, ruolo «${result.roleKey}». ` +
      (result.temporaryPassword === undefined
        ? 'La password non viene mostrata.'
        : 'Password temporanea sulla riga seguente di stdout: mostrata una sola volta, da consegnare su un canale sicuro; va cambiata al primo accesso.'),
  );
  if (result.temporaryPassword !== undefined) process.stdout.write(`${result.temporaryPassword}\n`);
} catch (error) {
  console.error(
    'Account non creato:',
    error instanceof LocalAccountError ? error.message : 'errore inatteso',
  );
  process.exitCode = 1;
} finally {
  process.stdin.destroy();
  await close();
}
