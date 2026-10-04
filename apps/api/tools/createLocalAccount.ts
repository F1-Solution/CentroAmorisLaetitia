/**
 * Crea un account locale per entrare nell'area amministrativa sul database
 * importato. I dati arrivano solo dalle variabili d'ambiente, e la password non
 * si stampa mai:
 *
 *     ACCOUNT_EMAIL=... ACCOUNT_NAME=... ACCOUNT_PASSWORD=... ACCOUNT_ROLE=editor \
 *       pnpm --filter @amoris/api account:create
 */
import { createDatabase } from '@amoris/db';
import { loadConfig } from '../src/config.js';
import {
  assertLocalDatabase,
  createLocalAccount,
  LocalAccountError,
  parseLocalAccountInput,
} from '../src/accounts/localAccount.js';

const config = loadConfig(process.env as Record<string, string | undefined>);
const { db, close } = createDatabase({ url: config.DATABASE_URL, maxConnections: 1 });

try {
  assertLocalDatabase(config.DATABASE_URL);
  const input = parseLocalAccountInput(process.env);
  const result = await createLocalAccount(db, config, input);
  console.error(
    `Account creato: ${result.email}, ruolo «${result.roleKey}». La password non viene mostrata.`,
  );
} catch (error) {
  console.error(
    'Account non creato:',
    error instanceof LocalAccountError ? error.message : 'errore inatteso',
  );
  process.exitCode = 1;
} finally {
  await close();
}
