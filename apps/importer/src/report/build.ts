import type { Mode } from '../stages/types.js';
import { ALL_REPORT_ROWS, EXPECTED_COUNTS } from './constants.js';
import type { ImportReport, ReportRow } from './types.js';

export interface BuildReportOptions {
  readonly runId: string;
  readonly mode: Mode;
  readonly importerVersion: string;
}

/**
 * Costruisce il rapporto per questa wave: nessuna fase di dominio è ancora
 * attuata (`IMPORTER-DESIGN.md` §2, `stages/`), quindi ogni riga mostra il
 * conteggio atteso e zero eseguiti, dichiarato come tale.
 */
export function buildStubReport(options: BuildReportOptions): ImportReport {
  const stages: ReportRow[] = ALL_REPORT_ROWS.map((row) => ({
    row,
    expected: EXPECTED_COUNTS[row],
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    implemented: false,
  }));

  return {
    runId: options.runId,
    mode: options.mode,
    importerVersion: options.importerVersion,
    sourceLabel: 'BackupDB-2026-09-13',
    stages,
    conversion: {
      gutenberg: 0,
      divi: 0,
      html: 0,
      blocksTotal: 0,
      blocksNonContainer: 0,
      fallbackBlocks: 0,
      fallbackPercent: 0,
      fallbackByReason: { 'unknown-shortcode': 0, 'unknown-attribute': 0, 'unclassified-html': 0 },
      contentsWithFallback: 0,
      thresholdPercentOk: true,
      thresholdContentsOk: true,
    },
    checks: [],
    skippedForEditorialWork: [],
    issues: [],
    outcome: 'success',
  };
}
