/**
 * Preparazione dell'ambiente end-to-end. Si esegue **prima** di
 * `playwright test`, non dentro Playwright: i server dichiarati in
 * `webServer` partono prima di `globalSetup`, e il servizio si troverebbe
 * davanti un database che non esiste ancora. Lo script di radice li mette in
 * fila:
 *
 *     pnpm test:e2e
 *
 * Tre passi, in quest'ordine, e ciascuno fallisce rumorosamente:
 *
 * 1. il database `amoris_e2e` si **ricrea da zero** e si migra;
 * 2. vi si scrive il **seme sintetico** di `apps/api/tools/seedSintetico.ts` —
 *    lo stesso che HO-006 usa per la prova a mano, così le schermate provate a
 *    mano e quelle provate qui partono dallo stesso stato;
 * 3. `apps/web` e `apps/admin` si **compilano** con `NEXT_PUBLIC_API_URL` che
 *    punta al servizio dell'end-to-end. Quella variabile finisce dentro il
 *    pacchetto al momento della compilazione: impostarla dopo non avrebbe
 *    effetto, ed è la ragione per cui la compilazione avviene qui e non nello
 *    script di `package.json`, dove passarla sarebbe diverso su Windows e su
 *    Linux.
 *
 * **Nessun dato reale**: il seme è inventato e il database viene distrutto e
 * ricreato a ogni esecuzione.
 */
import { spawnSync } from 'node:child_process';
import {
  ACCESSO,
  DATABASE_E2E,
  RADICE,
  STACK_URL,
  ambienteDeiServer,
  urlPerDatabase,
} from './support/ambiente';

function esegui(
  descrizione: string,
  comando: string,
  argomenti: readonly string[],
  env: Record<string, string>,
): void {
  const esito = spawnSync(comando, [...argomenti], {
    cwd: RADICE,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (esito.status !== 0) {
    throw new Error(`${descrizione}: comando fallito (${esito.status ?? 'interrotto'}).`);
  }
}

function prepara(): void {
  const env = ambienteDeiServer();
  const databaseUrl = urlPerDatabase(DATABASE_E2E);

  for (const chiave of ['IP_HASH_SALT', 'CSRF_SECRET', 'TOTP_ENCRYPTION_KEY']) {
    if (!env[chiave]) {
      throw new Error(
        `${chiave} non è impostata. Serve al servizio (ADR-007 §3.1 controllo 12): ` +
          'in locale sta nel `.env` della radice, in CI fra le variabili del flusso.',
      );
    }
  }

  esegui(
    'ricreazione del database end-to-end',
    'pnpm',
    ['--filter', '@amoris/db', 'exec', 'tsx', 'scripts/reset.ts'],
    { ...env, DATABASE_URL: databaseUrl },
  );

  esegui(
    'seme sintetico',
    'pnpm',
    ['--filter', '@amoris/api', 'exec', 'tsx', 'tools/seedSintetico.ts'],
    { ...env, DATABASE_URL: databaseUrl, SEED_PASSWORD: ACCESSO.password },
  );

  // Stack di immagini (1F-W2 T10): database e archivio dello stack sulle porte di prova,
  // applicazioni già costruite nelle immagini.
  if (STACK_URL !== undefined) return;

  /**
   * Le due applicazioni si compilano **una per volta e senza passare da
   * Turborepo**. Non è una preferenza di stile: invocato da qui, `turbo run
   * build` faceva fallire a intermittenza la compilazione dell'area
   * amministrativa con «'next' is not recognized», perché il `pnpm run`
   * annidato dentro il task non ritrovava l'eseguibile di Next nel percorso.
   * Chiamare direttamente il pacchetto toglie di mezzo un livello e rende
   * l'esito ripetibile, che qui vale più della cache.
   */
  for (const pacchetto of ['@amoris/web', '@amoris/admin']) {
    esegui(
      `compilazione di ${pacchetto}`,
      'pnpm',
      ['--filter', pacchetto, 'exec', 'next', 'build'],
      env,
    );
  }
}

prepara();
