/**
 * Schema PostgreSQL. Corrisponde a `docs/architecture/schema.sql`, che resta la
 * forma canonica e leggibile: la corrispondenza fra i due non e' un'intenzione,
 * la verifica lo script `pnpm db:verify`.
 */
export * from './enums.js';
export * from './types.js';
export * from './auth.js';
export * from './media.js';
export * from './content.js';
export * from './taxonomy.js';
export * from './menu.js';
export * from './seo.js';
export * from './redirects.js';
export * from './forms.js';
export * from './documents.js';
export * from './settings.js';
export * from './migration.js';
export * from './legacy.js';
