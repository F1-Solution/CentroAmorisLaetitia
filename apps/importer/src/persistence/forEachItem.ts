/**
 * L'isolamento dell'errore per elemento (`importer-spec.md` §7,
 * `IMPORTER-DESIGN.md` §4.2): dentro la transazione di una fase, l'errore su
 * un singolo elemento non la interrompe.
 *
 * **Scostamento dichiarato**: `IMPORTER-DESIGN.md` §4.2 abbozza un savepoint
 * manuale (`ctx.tx.savepoint()` / `.release()` / `.rollback()`). Qui si usa
 * invece la transazione annidata che Drizzle offre già su `postgres-js`:
 * `tx.transaction(fn)` dentro un'altra transazione emette
 * `SAVEPOINT` / `RELEASE SAVEPOINT` / `ROLLBACK TO SAVEPOINT` da sé, con lo
 * stesso effetto delle venti righe abbozzate lì, senza scriverle a mano.
 */
import type { StageResult } from '../stages/types.js';
import type { ItemKey } from '../stages/types.js';
import type { Tx } from './tx.js';

export type ItemOutcome = 'created' | 'updated' | 'skipped';

export async function forEachItem<T>(
  tx: Tx,
  items: readonly T[],
  key: (item: T) => ItemKey,
  body: (item: T, tx: Tx) => Promise<ItemOutcome>,
  onError: (key: ItemKey, error: unknown) => Promise<void>,
): Promise<StageResult> {
  const result = { created: 0, updated: 0, skipped: 0, errors: 0 };
  for (const item of items) {
    try {
      // Isolamento per elemento: deve avvenire in ordine, uno alla volta.
      const outcome = await tx.transaction((savepointTx) => body(item, savepointTx));
      result[outcome] += 1;
    } catch (error) {
      result.errors += 1;
      await onError(key(item), error);
    }
  }
  return result;
}
