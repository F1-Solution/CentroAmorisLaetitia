/**
 * `@amoris/blocks` — modello dei 14 tipi di blocco (ADR-005 §3.2), sanificazione
 * a elenco chiuso (§3.5), serializzazione deterministica (§3.6), componenti di
 * resa React (ADR-006 §3.3). Usato da `apps/web` e `apps/admin` (ADR-008 §3.1).
 *
 * Chi non disegna importa `@amoris/blocks/model`, che è lo stesso modello senza
 * i componenti di resa e quindi senza React.
 */
export * from './model.js';
export * from './render/index.js';
