import type { CheckResult } from '../types.js';

export interface DumpFingerprint {
  readonly sha256: string;
  readonly sizeBytes: number;
}

/** Controllo 1: il dump esiste, è leggibile, l'impronta coincide con quella registrata. */
export function checkDumpFingerprint(
  actual: DumpFingerprint,
  expected: DumpFingerprint,
): CheckResult {
  const ok = actual.sha256 === expected.sha256 && actual.sizeBytes === expected.sizeBytes;
  return {
    check: 'dump-fingerprint',
    ok,
    message: ok
      ? 'l’impronta del dump coincide con quella registrata'
      : 'l’impronta del dump non coincide: la sorgente non è quella congelata',
    detail: { expectedSha256: expected.sha256, actualSha256: actual.sha256 },
  };
}
