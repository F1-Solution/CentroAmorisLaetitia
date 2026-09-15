/**
 * Il modello dei blocchi **senza** i componenti di resa.
 *
 * Esiste perché non tutti i consumatori disegnano: l'importer e l'API leggono,
 * validano, ripuliscono e serializzano i blocchi, e non hanno alcun bisogno di
 * React. Importare il punto d'ingresso principale li costringerebbe a
 * dichiarare `jsx` e i tipi di React solo per leggere uno schema Zod.
 *
 * Chi disegna importa `@amoris/blocks`; chi non disegna importa
 * `@amoris/blocks/model`. La resa condivisa che ADR-006 §3.3 impone fra sito e
 * anteprima resta il punto d'ingresso principale, e questa separazione non la
 * indebolisce: toglie React a chi non lo usa, non aggiunge un secondo modello.
 */
export * from './common.js';
export * from './ids.js';
export * from './schema/index.js';
export * from './sanitize/index.js';
export * from './serialize/index.js';
export * from './reserve-count.js';
