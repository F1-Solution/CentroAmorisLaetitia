/**
 * Il corpo condiviso di `plan` e `apply`. I due comandi differiscono per il
 * modo e per la registrazione — `plan` non scrive nulla in `import_runs` né in
 * `import_issues` (`IMPORTER-DESIGN.md` §5.2) — e per nient'altro: eseguono le
 * stesse fasi, sullo stesso codice, e producono lo stesso rapporto.
 *
 * Collegato alle fasi vere nella wave `1D-W5c` (`IMPORTER-DESIGN.md` §11.8).
 */
import { randomUUID } from 'node:crypto';
import { buildReport } from '../../report/build.js';
import { renderReportText } from '../../report/text.js';
import { createIssueSink } from '../../persistence/issueSink.js';
import { createRun, finishRun } from '../../persistence/importRuns.js';
import { createObjectStore } from '../../storage/objectStore.js';
import { runImport } from '../../run/orchestrator.js';
import { ALL_STAGE_NAMES, type Mode, type StageName } from '../../stages/types.js';
import type { Runtime } from '../bootstrap.js';
import { importerVersion } from '../bootstrap.js';
import { runPreflightGate } from './preflightGate.js';
import type { ParsedArgs } from '../args.js';

export async function runImportCommand(
  runtime: Runtime,
  args: ParsedArgs,
  mode: Mode,
): Promise<number> {
  let onlyStage: StageName | null = null;
  if (args.stage !== null) {
    if (!ALL_STAGE_NAMES.includes(args.stage as StageName) || args.stage === 'preflight') {
      console.error(
        `--stage: fase sconosciuta '${args.stage}'. Fasi valide: ${ALL_STAGE_NAMES.filter((s) => s !== 'preflight').join(', ')}`,
      );
      return 1;
    }
    onlyStage = args.stage as StageName;
  }

  const preflight = await runPreflightGate(runtime);
  if (!preflight.ok) return 1;

  // In `plan` l'identificatore serve solo al rapporto: non esiste una riga in
  // `import_runs` a cui appartenga (§5.2 punto 2).
  const runId =
    mode === 'apply'
      ? await createRun(runtime.db, {
          isDryRun: false,
          sourceLabel: 'BackupDB-2026-09-13',
          importerVersion: importerVersion(),
        })
      : randomUUID();

  const issues = createIssueSink(runtime.db, mode, runId);
  const storage = createObjectStore(runtime.s3, {
    public: runtime.config.S3_BUCKET_PUBLIC,
    private: runtime.config.S3_BUCKET_PRIVATE,
  });

  if (onlyStage !== null) {
    console.error(
      `\nFASE SOLA: '${onlyStage}'. Le dipendenti non sono verificate in questa esecuzione: ` +
        'si assumono soddisfatte da una precedente (`importer-spec.md` §9).',
    );
  }

  const outcome = await runImport({
    db: runtime.db,
    source: runtime.source,
    storage,
    runId,
    mode,
    issues,
    options: {
      only: args.only,
      forceContentIds: args.forceContent,
      verbose: args.verbose,
    },
    ipHashSalt: runtime.config.IMPORTER_IP_HASH_SALT,
    onlyStage,
    onStageDone: (stage, result) => {
      // Solo conteggi e nomi di fase: il registro non ha una firma che accetti
      // testo libero, apposta (`IMPORTER-DESIGN.md` §8.4).
      runtime.logger.log({
        level: result.errors > 0 ? 'warn' : 'info',
        event: 'stage-done',
        runId,
        stage,
        count: result.created + result.updated,
      });
    },
  });

  const report = buildReport(
    { runId, mode, importerVersion: importerVersion() },
    { results: outcome.results, issues: issues.collected, aborted: outcome.aborted },
  );

  if (mode === 'apply') {
    await finishRun(runtime.db, runId, report.outcome, report);
  }

  console.error(renderReportText(report));

  if (outcome.aborted !== null) {
    console.error(
      `\nLa fase '${outcome.aborted.stage}' è fallita (${outcome.aborted.reason}) ed è stata annullata dalla propria transazione. ` +
        `Si corregge e si rilancia con: importer ${mode}${mode === 'apply' ? ' --confirm' : ''} --stage ${outcome.aborted.stage}`,
    );
  }
  if (outcome.skippedStages.length > 0) {
    console.error(
      `\nNon eseguite perché una loro dipendente non lo è stata: ${outcome.skippedStages.join(', ')}`,
    );
  }
  if (mode === 'plan') {
    console.error(
      '\nQuesta era una prova: la transazione è stata annullata e nel database non è rimasto nulla. ' +
        'Per eseguire davvero: importer apply --confirm.',
    );
  }

  return report.outcome === 'failed' ? 1 : 0;
}
