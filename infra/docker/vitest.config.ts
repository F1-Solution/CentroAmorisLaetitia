import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Prove delle immagini e del Compose di produzione (1F-W2 T4, T6): richiedono Docker e si
 * eseguono a parte con `pnpm test:images`, non con `pnpm test`.
 */
export default defineConfig({
  test: {
    root: path.resolve(import.meta.dirname, '..'),
    include: ['docker/tests/**/*.test.ts', 'deploy/tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 1_200_000,
    fileParallelism: false,
  },
});
