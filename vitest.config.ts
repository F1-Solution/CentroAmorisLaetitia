import { defineConfig } from 'vitest/config';

/**
 * Configurazione di radice, usata **solo per misurare la copertura**
 * (wave `1D-W10`).
 *
 * Le prove di tutti i giorni restano quelle di `pnpm test`, cioè una
 * esecuzione per pacchetto orchestrata da Turborepo, con la sua cache. Qui
 * invece i pacchetti si eseguono in un processo solo, perché la copertura si
 * misura una volta sull'insieme: otto misure separate non si sommano — un file
 * di `packages/blocks` è coperto anche dalle prove di `apps/api` che lo usano,
 * e sommare otto percentuali lo conterebbe otto volte o nessuna.
 *
 * Dal 2026-10-07 entra nella CI con una **soglia dell'80 %** su istruzioni,
 * diramazioni, funzioni e righe (DR-095): sotto soglia la verifica fallisce.
 * In locale si esegue con
 *
 *     pnpm test:coverage
 *
 * e la misura si scrive in `docs/qa/coverage-report.md`.
 *
 * Restano fuori le suite che leggono `source-private/` (DR-010): i pacchetti
 * dichiarano `tests/real/**` in una configurazione separata, e questa elenca
 * solo le configurazioni normali.
 */
export default defineConfig({
  test: {
    projects: [
      'apps/admin',
      'apps/api',
      'apps/importer',
      'apps/web',
      'packages/blocks',
      'packages/contracts',
      'packages/db',
      'packages/ui',
    ],
    /**
     * Molti file costruiscono database veri usa e getta. In parallelo si
     * contendono l'unico server PostgreSQL e i limiti di tempo saltano in modo
     * variabile: è lo stesso motivo per cui `apps/importer` e `packages/db`
     * disattivano il parallelismo fra file nella loro configurazione.
     */
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      // DR-095: sotto queste percentuali la verifica fallisce, anche in CI.
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        // Non è codice del prodotto: sono i punti d'ingresso dei server e le
        // dichiarazioni di configurazione, che nessuna prova esegue e che
        // conterebbero come «non coperto» senza dire nulla di utile.
        '**/*.d.ts',
        'apps/*/src/**/*.css',
        'apps/web/src/app/**',
        'packages/config/**',
      ],
    },
  },
});
