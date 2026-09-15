import type { CheckResult } from '../types.js';

/** Controllo 2: le tabelle attese esistono nella sorgente, né più né meno. */
export function checkTablesPresent(
  actualTables: readonly string[],
  expectedTables: readonly string[],
): CheckResult {
  const actualSet = new Set(actualTables);
  const expectedSet = new Set(expectedTables);
  const missing = expectedTables.filter((t) => !actualSet.has(t));
  const unexpected = actualTables.filter((t) => !expectedSet.has(t));
  const ok = missing.length === 0 && unexpected.length === 0;
  return {
    check: 'tables-present',
    ok,
    message: ok
      ? `tutte le ${expectedTables.length} tabelle attese sono presenti`
      : 'la sorgente è cambiata: il mapping va rivisto',
    detail: { missing, unexpected, expectedCount: expectedTables.length, actualCount: actualTables.length },
  };
}
