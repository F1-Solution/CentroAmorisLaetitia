import { defineConfig, devices } from '@playwright/test';

/**
 * Prove end-to-end (DR-007).
 *
 * In Fase 1C ce n'è una sola, e non riguarda il contenuto: riguarda le **regole
 * strutturali** di ADR-008 §3.3, che sono esattamente il genere di cosa che si
 * rompe in silenzio e si scopre tardi — un service worker comparso per sbaglio
 * falsa tutti i confronti visivi della Fase 1E.
 *
 * Il parco di prove della parità visiva nasce in Fase 1E, con le viewport e le
 * soglie fissate in `docs/qa/visual-regression-plan.md`.
 */
const WEB = 'http://127.0.0.1:3000';
const ADMIN = 'http://127.0.0.1:3001';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @amoris/web start',
      url: WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @amoris/admin start',
      url: `${ADMIN}/admin`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
