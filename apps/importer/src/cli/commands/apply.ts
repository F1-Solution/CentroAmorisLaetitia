import { buildStubReport } from '../../report/build.js';
import { renderReportText } from '../../report/text.js';
import { createRun, finishRun } from '../../persistence/importRuns.js';
import type { Runtime } from '../bootstrap.js';
import { importerVersion } from '../bootstrap.js';
import { runPreflightGate } from './preflightGate.js';
import type { ParsedArgs } from '../args.js';

/**
 * `importer apply --confirm` — scrive. Senza `--confirm` **non scrive nulla**
 * (`importer-spec.md` §3): è la stessa logica delle conferme obbligatorie di
 * `CLAUDE.md`.
 *
 * In questa wave (`1D-W2`) nessuna fase di dominio è attuata: `apply` crea la
 * riga in `import_runs`, esegue il preflight, e chiude l'esecuzione con un
 * rapporto che dice apertamente quali fasi non sono ancora scritte.
 */
export async function runApply(runtime: Runtime, args: ParsedArgs): Promise<number> {
  if (!args.confirm) {
    console.error(
      "apply richiede --confirm: senza, non scrive nulla. Esempio: importer apply --confirm",
    );
    return 1;
  }

  const preflight = await runPreflightGate(runtime);
  if (!preflight.ok) return 1;

  const runId = await createRun(runtime.db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: importerVersion(),
  });

  const report = buildStubReport({ runId, mode: 'apply', importerVersion: importerVersion() });
  await finishRun(runtime.db, runId, report.outcome, report);

  console.error(renderReportText(report));
  console.error(JSON.stringify(report, null, 2));
  console.error(
    '\nNota: le fasi di dominio (settings, users, media, ...) non sono ancora attuate. ' +
      'Arrivano nelle wave 1D-W4 e 1D-W5 (vedi PLAN.md §1). Questa esecuzione ha creato solo la riga di registro.',
  );
  return 0;
}
