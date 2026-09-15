import { defineConfig } from 'vitest/config';

/**
 * La CI esegue solo questa configurazione: raccoglie `tests/unit/**`.
 * `tests/real/**` non è incluso qui apposta — si esegue con
 * `vitest.real.config.ts`, mai in CI (DR-010).
 */
export default defineConfig({
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
});
