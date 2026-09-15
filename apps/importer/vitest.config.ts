import { defineConfig } from 'vitest/config';

/**
 * La CI esegue solo questa configurazione: raccoglie `tests/unit/**`.
 * `tests/real/**` non è incluso qui apposta — si esegue con
 * `vitest.real.config.ts`, mai in CI (DR-010).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    /**
     * Stessa scelta di `packages/db`, e per lo stesso motivo: molti test qui
     * costruiscono e distruggono database veri. Eseguiti in parallelo si
     * contendono l'unico server PostgreSQL e superano il limite predefinito di
     * cinque secondi, in modo variabile da esecuzione a esecuzione — il genere
     * di fallimento che in CI sembra casuale e non lo è.
     */
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
