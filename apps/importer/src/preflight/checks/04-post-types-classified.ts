import type { CheckResult } from '../types.js';
import { CLASSIFIED_POST_TYPES } from '../constants.js';

/** Controllo 4: i `post_type` distinti sono tutti classificati nel mapping §2. */
export function checkPostTypesClassified(distinctPostTypes: readonly string[]): CheckResult {
  const classified = new Set(CLASSIFIED_POST_TYPES);
  const unclassified = distinctPostTypes.filter((type) => !classified.has(type));
  const ok = unclassified.length === 0;
  return {
    check: 'post-types-classified',
    ok,
    message: ok
      ? `tutti i ${distinctPostTypes.length} post_type distinti sono classificati`
      : `${unclassified.length} post_type non classificato/i: il mapping è incompleto`,
    detail: { unclassifiedCount: unclassified.length, unclassifiedTypes: unclassified },
  };
}
