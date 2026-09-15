import { randomUUID } from 'node:crypto';
import { buildStubReport } from '../../report/build.js';
import { renderReportText } from '../../report/text.js';
import type { Runtime } from '../bootstrap.js';
import { importerVersion } from '../bootstrap.js';
import { runPreflightGate } from './preflightGate.js';

/**
 * `importer plan` — esegue tutto senza scrivere, produce il rapporto
 * (`importer-spec.md` §3). Non chiama mai `createRun`/`recordIssue`: in modo
 * `plan` non si scrive nulla in `import_runs` né in `import_issues`
 * (`IMPORTER-DESIGN.md` §5.2).
 *
 * In questa wave (`1D-W2`) nessuna fase di dominio è attuata: il rapporto
 * mostra i conteggi attesi e zero eseguiti, dichiarato riga per riga.
 */
export async function runPlan(runtime: Runtime): Promise<number> {
  const preflight = await runPreflightGate(runtime);
  if (!preflight.ok) return 1;

  const report = buildStubReport({
    runId: randomUUID(),
    mode: 'plan',
    importerVersion: importerVersion(),
  });

  console.error(renderReportText(report));
  console.error(JSON.stringify(report, null, 2));
  return 0;
}
