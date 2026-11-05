import { defineConfig } from 'vitest/config';

/**
 * Prove delle immagini di produzione (1F-W2 T4): richiedono Docker e si eseguono a parte con
 * `pnpm test:images`, non con `pnpm test`.
 */
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 1_200_000,
    fileParallelism: false,
  },
});
