import type { CheckResult } from '../types.js';

export interface OpenRun {
  readonly id: string;
}

/** Controllo 8: nessuna delle esecuzioni precedenti è rimasta aperta. */
export function checkNoOpenRuns(openRuns: readonly OpenRun[]): CheckResult {
  const ok = openRuns.length === 0;
  return {
    check: 'no-open-runs',
    ok,
    message: ok
      ? 'nessuna esecuzione precedente è rimasta aperta'
      : `${openRuns.length} esecuzione/i interrotta/e da riprendere`,
    detail: { openRunIds: openRuns.map((r) => r.id) },
  };
}
