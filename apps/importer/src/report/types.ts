import type { HtmlBlockReason } from '@amoris/blocks/model';
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

/**
 * **Correzione della wave `1D-W5c`.** Fino a qui questo tipo elencava tre
 * motivi inventati in `1D-W2`, quando i convertitori non esistevano ancora.
 * I motivi veri sono i cinque di `HTML_BLOCK_REASONS` (`@amoris/blocks`,
 * `BLOCK-MODEL.md` §8.2), ed è quello che il rapporto deve riportare: un
 * vocabolario parallelo avrebbe costretto a una traduzione fra i due, e una
 * traduzione fra due elenchi che cambiano è il punto in cui si perde un
 * motivo senza accorgersene.
 */
export type FallbackReason = HtmlBlockReason;

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
  /**
   * Falso quando la verifica non ha potuto misurare nulla — per esempio
   * `files-vs-expected` e `checksum-mismatches` quando lo storage non è
   * raggiungibile (`importer-spec.md` §16, ultimo paragrafo): `ok` resta
   * `false` in quel caso, mai «passata» per assenza di prova.
   */
  readonly executed: boolean;
}

export type IssueCode =
  | 'unclassified-value-form'
  | 'invalid-utf8-byte'
  | 'unknown-shortcode'
  | 'unknown-attribute'
  | 'editorial-work-protected'
  | 'stage-not-implemented'
  | 'item-import-failed'
  | 'unclassified-capabilities'
  | 'settings-value-missing'
  | 'document-file-unresolved'
  | 'redirect-self-loop'
  | 'redirect-unresolved-target'
  | 'redirect-protected-by-manual'
  | 'uploads-reference-remaining'
  | 'verification-check-failed'
  | 'verification-check-not-executed'
  | 'table-count-mismatch';

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
