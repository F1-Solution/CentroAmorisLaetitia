export type CheckName =
  | 'dump-fingerprint'
  | 'tables-present'
  | 'meta-keys-classified'
  | 'post-types-classified'
  | 'schema-version'
  | 'storage-reachable'
  | 'uploads-count'
  | 'no-open-runs';

export interface CheckResult {
  readonly check: CheckName;
  readonly ok: boolean;
  /** Frase breve, senza dati della sorgente: solo identificatori e conteggi. */
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface PreflightReport {
  readonly ok: boolean;
  readonly results: readonly CheckResult[];
}
