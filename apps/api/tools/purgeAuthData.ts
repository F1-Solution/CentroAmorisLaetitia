/**
 * Pulizia periodica: cancella sessioni scadute o revocate e righe dei tentativi da più di 30 giorni.
 *
 *     pnpm --filter @amoris/api auth:purge
 */
import { createDatabase } from '@amoris/db';
import { loadConfig } from '../src/config.js';
import { purgeAuthData } from '../src/maintenance/purgeAuthData.js';

const config = loadConfig(process.env as Record<string, string | undefined>);
const { db, close } = createDatabase({ url: config.DATABASE_URL, maxConnections: 1 });

try {
  const { sessions, attempts } = await purgeAuthData(db);
  console.error(
    `Pulizia eseguita: ${sessions} sessioni e ${attempts} righe di tentativi cancellate.`,
  );
} catch (error) {
  console.error(
    'Pulizia non eseguita:',
    error instanceof Error ? error.message : 'errore inatteso',
  );
  process.exitCode = 1;
} finally {
  await close();
}
