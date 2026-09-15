/**
 * Punto unico da cui il modulo `convert` vede `@amoris/blocks`.
 *
 * **Deviazione dichiarata, da segnalare nell'audit.** `packages/blocks`
 * espone un solo punto d'ingresso (`exports: { ".": "./src/index.ts" }`), e
 * quel punto d'ingresso importa anche `render/` — componenti React in `.tsx`.
 * Un pacchetto che non ha mai bisogno di JSX (questo, `apps/importer`, una
 * riga di comando) non può importare `@amoris/blocks` col percorso normale
 * senza che `tsc` pretenda `--jsx` e i tipi di React solo per leggere schemi e
 * funzioni pure: non è un problema di `apps/importer`, è la forma del
 * pacchetto. La correzione giusta sarebbe un `exports` con più voci in
 * `packages/blocks/package.json` (per esempio `"./schema"`, `"./sanitize"`),
 * ma `packages/blocks` è fuori dal perimetro di questa wave (`PLAN.md` §2:
 * «Non modificare packages/blocks... Se ti serve una modifica, fermati e
 * dillo»). Qui ci si ferma e lo si dice, e nel frattempo si importa **solo**
 * dai file sorgente che non toccano `render/`, con percorsi relativi che non
 * passano dalla mappa `exports` del pacchetto — quindi non serve alcuna nuova
 * dipendenza dichiarata, e `packages/blocks` non si tocca.
 */
export * from '../../../../../packages/blocks/src/common.js';
export * from '../../../../../packages/blocks/src/ids.js';
export * from '../../../../../packages/blocks/src/schema/index.js';
export * from '../../../../../packages/blocks/src/sanitize/index.js';
export * from '../../../../../packages/blocks/src/serialize/index.js';
export * from '../../../../../packages/blocks/src/reserve-count.js';
