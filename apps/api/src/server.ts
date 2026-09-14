import { buildApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';

/**
 * Avvio del servizio. Nessuna migrazione qui dentro: le migrazioni sono un passo
 * esplicito del rilascio (ADR-009 §4.4).
 */

let config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    console.error('\nCopia .env.example in .env e completa le variabili mancanti.');
    process.exit(78); // EX_CONFIG
  }
  throw error;
}

const app = await buildApp(config);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'arresto in corso');
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.fatal({ err: error }, 'avvio fallito');
  process.exit(1);
}
