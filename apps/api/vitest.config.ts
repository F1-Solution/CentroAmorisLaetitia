import { defineConfig } from 'vitest/config';

/**
 * Molti test qui costruiscono e distruggono database veri, come in
 * `packages/db` e in `apps/importer`: eseguiti in parallelo si contendono
 * l'unico server PostgreSQL e superano il limite predefinito di cinque secondi,
 * in modo variabile da esecuzione a esecuzione.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
