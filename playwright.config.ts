import { defineConfig, devices } from '@playwright/test';
import {
  ADMIN_URL,
  API_URL,
  PORTE,
  WEB_URL,
  ambienteDeiServer,
} from './tests/e2e/support/ambiente';

/**
 * Prove end-to-end (DR-007).
 *
 * In Fase 1C ce n'era una sola, sulle **regole strutturali** di ADR-008 §3.3.
 * La wave `1D-W10` aggiunge i **flussi del CMS**, eseguiti contro le tre
 * applicazioni avviate e un database seminato con dati sintetici: è la classe
 * di difetti che le prove unitarie non vedono, perché si manifesta solo dove
 * c'è un browser, un'applicazione servita sotto un percorso e una richiesta
 * che attraversa la rete (nota del Round 15 nel registro delle decisioni).
 *
 * Tutto ciò che serve prima — database, seme, compilazione — sta in
 * `tests/e2e/prepara.ts`, che lo script `pnpm test:e2e` esegue **prima** di
 * chiamare Playwright: i server di `webServer` partono prima di un eventuale
 * `globalSetup`, e troverebbero un database che non esiste ancora. Le porte e
 * gli indirizzi stanno in `tests/e2e/support/ambiente.ts`, e sono **diversi**
 * da quelli di sviluppo.
 *
 * Il parco di prove della parità visiva nasce in Fase 1E, con le viewport e le
 * soglie fissate in `docs/qa/visual-regression-plan.md`.
 */
const env = ambienteDeiServer();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @amoris/api exec tsx src/server.ts',
      url: `${API_URL}/health/ready`,
      // Mai riusato: un servizio già acceso su questa porta punterebbe a un
      // altro database, e le prove direbbero cose vere su ciò che non stanno
      // provando.
      reuseExistingServer: false,
      env,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `pnpm --filter @amoris/web exec next start -p ${PORTE.web}`,
      url: WEB_URL,
      reuseExistingServer: false,
      env,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter @amoris/admin exec next start -p ${PORTE.admin}`,
      url: `${ADMIN_URL}/admin`,
      reuseExistingServer: false,
      env,
      timeout: 120_000,
    },
  ],
});
