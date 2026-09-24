import type { Mode, StageName, StageResult } from '../stages/types.js';
import { STAGE_REPORT_ROW } from '../stages/types.js';
import { ALL_REPORT_ROWS, EXPECTED_COUNTS } from './constants.js';
import type {
  ConversionSummary,
  ImportReport,
  ReportIssue,
  ReportRow,
  ReportRowName,
  VerificationCheck,
} from './types.js';

export interface BuildReportOptions {
  readonly runId: string;
  readonly mode: Mode;
  readonly importerVersion: string;
}

const EMPTY_CONVERSION: ConversionSummary = {
  gutenberg: 0,
  divi: 0,
  html: 0,
  blocksTotal: 0,
  blocksNonContainer: 0,
  fallbackBlocks: 0,
  fallbackPercent: 0,
  fallbackByReason: {
    wp_html_block: 0,
    divi_unmapped_module: 0,
    divi_unmapped_markup: 0,
    shortcode_unknown: 0,
    manual: 0,
  },
  contentsWithFallback: 0,
  thresholdPercentOk: true,
  thresholdContentsOk: true,
};

/**
 * Costruisce il rapporto per un'esecuzione che **non** ha eseguito alcuna
 * fase: serve a `report --run <id>` quando l'esecuzione non ha un riepilogo
 * salvato, e ai test. Un'esecuzione vera passa da {@link buildReport}.
 */
export function buildStubReport(options: BuildReportOptions): ImportReport {
  return buildReport(options, {
    results: new Map(),
    issues: [],
    aborted: null,
  });
}

export interface ReportInput {
  readonly results: ReadonlyMap<StageName, StageResult>;
  readonly issues: readonly ReportIssue[];
  /** La fase che ha interrotto l'esecuzione, se ce n'è stata una. */
  readonly aborted: { readonly stage: StageName; readonly reason: string } | null;
}

/**
 * Da ciò che le fasi hanno misurato al rapporto di `importer-spec.md` §8.1.
 * Un solo oggetto, due rappresentazioni (`IMPORTER-DESIGN.md` §8.1): la forma
 * testuale è in `text.ts` e legge questo, non i contatori.
 *
 * **La tabella conta per fase, non per tabella del database** (§8.1): dodici
 * righe contro diciassette fasi, con `STAGE_REPORT_ROW` a dire quale fase
 * alimenta quale riga e `extraRows` per l'unico caso in cui una fase ne
 * alimenta due (`media` e `media_variants`).
 */
export function buildReport(options: BuildReportOptions, input: ReportInput): ImportReport {
  const perRow = new Map<ReportRowName, StageResult>();
  const executedRows = new Set<ReportRowName>();

  for (const [stageName, result] of input.results) {
    const row = STAGE_REPORT_ROW[stageName];
    if (row !== null) {
      perRow.set(row, addCounters(perRow.get(row), result.rowResult ?? result));
      executedRows.add(row);
    }
    for (const [extraRow, extra] of Object.entries(result.extraRows ?? {})) {
      const name = extraRow as ReportRowName;
      perRow.set(name, addCounters(perRow.get(name), extra));
      executedRows.add(name);
    }
  }

  const stages: ReportRow[] = ALL_REPORT_ROWS.map((row) => {
    const measured = perRow.get(row);
    return {
      row,
      expected: EXPECTED_COUNTS[row],
      created: measured?.created ?? 0,
      updated: measured?.updated ?? 0,
      skipped: measured?.skipped ?? 0,
      errors: measured?.errors ?? 0,
      implemented: executedRows.has(row),
    };
  });

  const conversion = firstDefined(input.results, (r) => r.conversion) ?? EMPTY_CONVERSION;
  const checks: readonly VerificationCheck[] = firstDefined(input.results, (r) => r.checks) ?? [];
  const skippedForEditorialWork = (
    firstDefined(input.results, (r) => r.skippedForEditorialWork) ?? []
  ).map((contentId) => ({ contentId }));

  return {
    runId: options.runId,
    mode: options.mode,
    importerVersion: options.importerVersion,
    sourceLabel: 'BackupDB-2026-09-13',
    stages,
    conversion,
    checks,
    skippedForEditorialWork,
    issues: input.issues,
    outcome: decideOutcome(stages, conversion, checks, input),
  };
}

/**
 * L'esito, secondo `importer-spec.md` §8.2: **un conteggio che non coincide
 * impedisce `success`**, anche senza un solo errore.
 *
 * Il confronto dei conteggi **non si fa qui**. §8.1 lo assegna esplicitamente
 * alla fase 16: «il confronto con i volumi di tabella spetta alla fase 16
 * `verify`, non a questa tabella». La fase `verify` misura i volumi veri e
 * registra un `table-count-mismatch` per ogni scostamento, che arriva qui come
 * errore e degrada l'esito. Rifarlo in questa funzione, sulla colonna
 * `ATTESI`, darebbe un secondo verdetto con una formula diversa — e la formula
 * sarebbe sbagliata, perché `SALTATI` significa cose opposte a seconda della
 * fase: un contenuto protetto esiste come riga, un redirect scartato no.
 *
 * Un contenuto saltato per proteggere il lavoro di un redattore non è un
 * errore e non degrada l'esito: è il comportamento voluto di §6.3, e
 * degradarlo insegnerebbe a ignorare l'esito.
 */
function decideOutcome(
  stages: readonly ReportRow[],
  conversion: ConversionSummary,
  checks: readonly VerificationCheck[],
  input: ReportInput,
): ImportReport['outcome'] {
  if (input.aborted !== null) return 'failed';
  if (input.results.size === 0) return 'success';

  const hasErrors = stages.some((row) => row.errors > 0);
  const stageErrors = [...input.results.values()].some((result) => result.errors > 0);
  const checkFailed = checks.some((check) => !check.executed || !check.ok);
  const thresholdExceeded = !conversion.thresholdPercentOk || !conversion.thresholdContentsOk;

  return hasErrors || stageErrors || checkFailed || thresholdExceeded ? 'partial' : 'success';
}

function addCounters(a: StageResult | undefined, b: StageResult): StageResult {
  if (!a) return { created: b.created, updated: b.updated, skipped: b.skipped, errors: b.errors };
  return {
    created: a.created + b.created,
    updated: a.updated + b.updated,
    skipped: a.skipped + b.skipped,
    errors: a.errors + b.errors,
  };
}

/**
 * Le tre sezioni fuori tabella le produce una fase sola ciascuna
 * (`contents` e `verify`): si prende la prima definita invece di sommarle,
 * perché sommare due riepiloghi di conversione non vorrebbe dire nulla.
 */
function firstDefined<T>(
  results: ReadonlyMap<StageName, StageResult>,
  pick: (result: StageResult) => T | undefined,
): T | undefined {
  for (const result of results.values()) {
    const value = pick(result);
    if (value !== undefined) return value;
  }
  return undefined;
}
