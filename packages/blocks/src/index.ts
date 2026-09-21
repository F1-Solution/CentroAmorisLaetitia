/**
 * `@amoris/blocks` — modello dei 14 tipi di blocco (ADR-005 §3.2), sanificazione
 * a elenco chiuso (§3.5), serializzazione deterministica (§3.6), componenti di
 * resa React (ADR-006 §3.3). Usato da `apps/web` e `apps/admin` (ADR-008 §3.1).
 *
 * Chi non disegna importa `@amoris/blocks/model`, che è lo stesso modello senza
 * i componenti di resa e quindi senza React.
 *
 * **Gli specificatori interni sono senza estensione, e non si rimettano.** Il
 * pacchetto viene consumato **a sorgente** da `apps/admin`, che lo compila con
 * Turbopack: Turbopack non traduce `./x.js` in `./x.ts`, e con l'estensione la
 * compilazione dell'area amministrativa fallisce con «module not found» — cioè
 * lontano da qui, su un errore che non nomina questo file. `tsx`, `vitest` e
 * `tsc` con risoluzione «Bundler» risolvono tutti senza estensione, come già
 * fa `packages/ui`. Cambiato il 2026-09-21, wave `1D-W8b`.
 */
export * from './model';
export * from './render/index';
