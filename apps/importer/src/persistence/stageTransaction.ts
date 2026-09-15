/**
 * La transazione di una fase (`IMPORTER-DESIGN.md` §4.3, §5.1, §5.2): una per
 * fase, non una per esecuzione. In modo `plan` la fase scrive per davvero —
 * vincoli e chiavi esterne compresi — e poi la transazione viene annullata:
 * non è una simulazione, è la stessa strada con un `ROLLBACK` alla fine.
 */
import type { Database } from '@amoris/db';
import type { Mode } from '../stages/types.js';
import type { Tx } from './tx.js';

const PLAN_ROLLBACK = Symbol('rollback deliberato del modo plan');

/**
 * Esegue `fn` dentro la transazione della fase. In `apply` la transazione va a
 * `COMMIT` se `fn` non solleva; in `plan` va sempre a `ROLLBACK`, qualunque sia
 * l'esito di `fn` — è la sola differenza di comportamento fra i due modi
 * dentro questa funzione.
 */
export async function runStageTransaction<T>(
  db: Database,
  mode: Mode,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (mode === 'apply') {
    return db.transaction((tx) => fn(tx));
  }

  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx);
      throw PLAN_ROLLBACK;
    });
  } catch (error) {
    if (error !== PLAN_ROLLBACK) throw error;
  }
  // `result` è sempre assegnato quando si arriva qui senza rilanciare: se `fn`
  // avesse sollevato un errore vero, sarebbe uscito dal blocco `catch` sopra.
  return result as T;
}
