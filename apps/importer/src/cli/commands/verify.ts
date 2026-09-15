import type { Runtime } from '../bootstrap.js';

/**
 * `importer verify` — solo controlli, senza leggere la sorgente
 * (`importer-spec.md` §3). È la fase 16 `verify` di `IMPORTER-DESIGN.md` §4.1,
 * attuata in `1D-W5`. Qui il comando è riconosciuto e dichiara apertamente di
 * non essere ancora scritto: non finge di verificare nulla.
 */
export async function runVerify(_runtime: Runtime): Promise<number> {
  console.error(
    "Il comando 'verify' non è ancora attuato: la fase 16 (verify) arriva in 1D-W5 (PLAN.md §1).",
  );
  return 1;
}
