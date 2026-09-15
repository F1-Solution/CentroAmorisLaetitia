/**
 * `@amoris/blocks` — modello dei 14 tipi di blocco (ADR-005 §3.2), sanificazione
 * a elenco chiuso (§3.5), serializzazione deterministica (§3.6), componenti di
 * resa React (ADR-006 §3.3). Usato da `apps/web` e `apps/admin` (ADR-008 §3.1).
 */
export * from './common.js';
export * from './ids.js';
export * from './schema/index.js';
export * from './sanitize/index.js';
export * from './serialize/index.js';
export * from './reserve-count.js';
export * from './render/index.js';
