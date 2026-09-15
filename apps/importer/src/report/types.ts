import type { Mode } from '../stages/types.js';

/** Le righe del rapporto di `importer-spec.md` §8.1 — per output, non per fase. */
export type ReportRowName =
  | 'settings'
  | 'users'
  | 'media'
  | 'media_variants'
  | 'terms'
  | 'contents'
  | 'menu_items'
  | 'forms'
  | 'form_submissions'
  | 'documents'
  | 'slider_slides'
  | 'redirects';

export interface ReportRow {
  readonly row: ReportRowName;
  /** `null` quando il numero atteso non è ancora un intero fisso (per esempio `~1376`). */
  readonly expected: number | null;
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly errors: number;
  /** In questa wave, quasi tutte le righe non sono ancora attuate: lo si dichiara, non lo si finge. */
  readonly implemented: boolean;
}

export type FallbackReason = 'unknown-shortcode' | 'unknown-attribute' | 'unclassified-html';

export interface ConversionSummary {
  readonly gutenberg: number;
  readonly divi: number;
  readonly html: number;
  readonly blocksTotal: number;
  readonly blocksNonContainer: number;
  readonly fallbackBlocks: number;
  readonly fallbackPercent: number;
  readonly fallbackByReason: Readonly<Record<FallbackReason, number>>;
  readonly contentsWithFallback: number;
  readonly thresholdPercentOk: boolean;
  readonly thresholdContentsOk: boolean;
}

export type CheckName =
  | 'uploads-references-remaining'
  | 'files-vs-expected'
  | 'checksum-mismatches'
  | 'media-missing'
  | 'menu-items-dangling'
  | 'redirects-to-404'
  | 'contents-without-path'
  | 'meta-keys-unclassified';

export interface VerificationCheck {
  readonly check: CheckName;
  readonly value: number;
  readonly expected: number;
  readonly ok: boolean;
}

export type IssueCode =
  | 'unclassified-value-form'
  | 'invalid-utf8-byte'
  | 'unknown-shortcode'
  | 'unknown-attribute'
  | 'editorial-work-protected'
  | 'stage-not-implemented';

export interface ReportIssue {
  readonly severity: 'info' | 'warning' | 'error';
  readonly stage: string;
  readonly code: IssueCode;
  readonly sourceTable: string;
  readonly sourceId: number;
  /** Da vocabolario chiuso, mai un contenuto: `IMPORTER-DESIGN.md` §8.2. */
  readonly detail: string | null;
}

export interface ImportReport {
  readonly runId: string;
  readonly mode: Mode;
  readonly importerVersion: string;
  readonly sourceLabel: 'BackupDB-2026-09-13';
  readonly stages: readonly ReportRow[];
  readonly conversion: ConversionSummary;
  readonly checks: readonly VerificationCheck[];
  readonly skippedForEditorialWork: readonly { contentId: string }[];
  readonly issues: readonly ReportIssue[];
  readonly outcome: 'success' | 'partial' | 'failed';
}
