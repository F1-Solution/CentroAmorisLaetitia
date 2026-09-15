import { defineConfig } from 'vitest/config';

/**
 * Suite separata per i test che leggono `source-private/`. Non gira in CI,
 * non è inclusa in `pnpm test` (DR-010, `IMPORTER-DESIGN.md` §9.3).
 *
 * Si esegue solo in locale, esplicitamente:
 *   pnpm --filter @amoris/importer exec vitest run --config vitest.real.config.ts
 *
 * Ogni test di questa suite verifica da sé che la sorgente reale sia
 * raggiungibile e si salta, dichiarandolo, se non lo è.
 */
export default defineConfig({
  test: { environment: 'node', include: ['tests/real/**/*.real.test.ts'] },
});
