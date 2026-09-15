/**
 * Punto unico da cui il modulo `convert` vede `@amoris/blocks`.
 *
 * Si importa `@amoris/blocks/model`, cioè il modello senza i componenti di resa:
 * l'importer è una riga di comando e non disegna nulla, quindi non deve tirarsi
 * dietro React per leggere uno schema Zod. La resa condivisa fra sito e anteprima
 * (ADR-006 §3.3) resta il punto d'ingresso principale del pacchetto.
 */
export * from '@amoris/blocks/model';
