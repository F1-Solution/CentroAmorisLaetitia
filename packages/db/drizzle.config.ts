import { defineConfig } from 'drizzle-kit';

/**
 * ADR-002: Drizzle con drizzle-kit per le migrazioni.
 * `casing: 'snake_case'` attua DR-036 per convenzione.
 *
 * Le migrazioni generate si **leggono prima di applicarle**: e' una regola,
 * non una buona abitudine (ADR-002 §5).
 */
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://amoris:sviluppo-locale@localhost:5432/amoris',
  },
  verbose: true,
  strict: true,
});
