import type { CheckResult } from '../types.js';
import { isClassifiedPostmetaKey } from '../constants.js';

/**
 * Controllo 3 — quello che protegge davvero: una chiave meta comparsa e non
 * classificata è un dato che si sta per perdere in silenzio
 * (`importer-spec.md` §5).
 */
export function checkMetaKeysClassified(distinctKeys: readonly string[]): CheckResult {
  const unclassified = distinctKeys.filter((key) => !isClassifiedPostmetaKey(key));
  const ok = unclassified.length === 0;
  return {
    check: 'meta-keys-classified',
    ok,
    message: ok
      ? `tutte le ${distinctKeys.length} chiavi meta distinte sono classificate`
      : `${unclassified.length} chiave/i meta non classificata/e: il mapping è incompleto`,
    detail: { unclassifiedCount: unclassified.length, unclassifiedKeys: unclassified },
  };
}
