import { getRun } from '../../persistence/importRuns.js';
import { renderReportText } from '../../report/text.js';
import type { ImportReport } from '../../report/types.js';
import type { Runtime } from '../bootstrap.js';
import type { ParsedArgs } from '../args.js';

/** `importer report --run <id>` — ristampa il rapporto di un'esecuzione. */
export async function runReport(runtime: Runtime, args: ParsedArgs): Promise<number> {
  const run = await getRun(runtime.db, args.run!);
  if (!run) {
    console.error(`Nessuna esecuzione trovata con id ${args.run}.`);
    return 1;
  }
  const report = run.summary as ImportReport;
  console.error(renderReportText(report));
  console.error(JSON.stringify(report, null, 2));
  return 0;
}
