import { randomUUID } from 'node:crypto';
import { buildReport } from '../../report/build.js';
import { createIssueSink } from '../../persistence/issueSink.js';
import { createObjectStore } from '../../storage/objectStore.js';
import { runImport } from '../../run/orchestrator.js';
import type { Runtime } from '../bootstrap.js';
import { importerVersion } from '../bootstrap.js';

/**
 * `importer verify` — solo controlli, nessuna importazione
 * (`importer-spec.md` §3). Esegue la sola fase 16 `verify`, che misura le otto
 * righe VERIFICHE di §8.1 e i volumi di tabella di `database-schema.md` §6.
 *
 * **Scostamento dichiarato da `importer-spec.md` §3**, che descrive questo
 * comando come «senza leggere la sorgente». Due degli otto controlli che §8.1
 * pretende la leggono per forza: «checksum non corrispondenti» confronta i
 * file del bucket con quelli su disco, e «chiavi meta non classificate»
 * rilegge `wp_postmeta`. Escluderli renderebbe `verify` piu' debole del
 * rapporto che ristampa, che non è ciò che il comando serve a fare. La
 * sorgente resta in sola lettura, come sempre.
 *
 * Gira in modo `plan`: la fase non scrive dati di dominio, e cosi' non lascia
 * nemmeno una riga in `import_runs` o `import_issues` per una misura che
 * nessuno ha chiesto di registrare (`IMPORTER-DESIGN.md` §5.2).
 */
export async function runVerify(runtime: Runtime): Promise<number> {
  const runId = randomUUID();
  const issues = createIssueSink(runtime.db, 'plan', runId);
  const storage = createObjectStore(runtime.s3, {
    public: runtime.config.S3_BUCKET_PUBLIC,
    private: runtime.config.S3_BUCKET_PRIVATE,
  });

  const outcome = await runImport({
    db: runtime.db,
    source: runtime.source,
    storage,
    runId,
    mode: 'plan',
    issues,
    options: { only: null, forceContentIds: [], verbose: false },
    ipHashSalt: null,
    onlyStage: 'verify',
  });

  if (outcome.aborted !== null) {
    console.error(`La verifica è fallita: ${outcome.aborted.reason}`);
    return 1;
  }

  const report = buildReport(
    { runId, mode: 'plan', importerVersion: importerVersion() },
    { results: outcome.results, issues: issues.collected, aborted: null },
  );

  // Si stampa solo ciò che questo comando ha davvero misurato. La tabella per
  // fase del rapporto resterebbe a zero, e stamparla farebbe credere a un
  // import vuoto: per quella c'è `importer report --run <id>`.
  console.error('VERIFICHE');
  if (report.checks.length === 0) console.error('  (nessun controllo misurato)');
  for (const check of report.checks) {
    const verdict = !check.executed ? 'NON ESEGUITA' : check.ok ? 'ok' : 'NON SUPERATA';
    console.error(`  ${check.check}: ${check.value}, atteso ${check.expected} — ${verdict}`);
  }
  for (const issue of issues.collected) {
    console.error(`  [${issue.severity}] ${issue.code}: ${issue.detail ?? issue.sourceTable}`);
  }

  const superate = report.checks.every((check) => check.executed && check.ok);
  const scostamenti = issues.collected.filter((issue) => issue.severity === 'error').length;
  console.error(
    superate && scostamenti === 0
      ? '\nTutti i controlli sono superati.'
      : `\n${scostamenti} scostamenti. Il dettaglio è nel rapporto dell'ultima esecuzione: importer report --run <id>`,
  );
  return superate && scostamenti === 0 ? 0 : 1;
}
