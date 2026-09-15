import type { Runtime } from '../bootstrap.js';
import type { ParsedArgs } from '../args.js';

/**
 * `importer rollback --run <id>` — annulla un'esecuzione (`importer-spec.md`
 * §9). Attuato in `1D-W5` (`IMPORTER-DESIGN.md` §7). Qui il comando è
 * riconosciuto, richiede `--run` e dichiara apertamente di non essere ancora
 * scritto.
 */
export async function runRollback(_runtime: Runtime, _args: ParsedArgs): Promise<number> {
  console.error("Il comando 'rollback' non è ancora attuato: arriva in 1D-W5 (PLAN.md §1).");
  return 1;
}
