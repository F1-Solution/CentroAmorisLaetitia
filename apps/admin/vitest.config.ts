import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    // Vedi `tests/setup.ts`: la prima resa di un file, su una macchina carica,
    // supera i 5 s predefiniti.
    testTimeout: 20000,
  },
});
