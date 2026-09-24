import type { CheckResult } from '../types.js';

/** Controllo 5: lo schema di destinazione è alla versione di migrazione attesa. */
export function checkSchemaVersion(
  appliedMigrationTags: readonly string[],
  expectedMigrationTags: readonly string[],
): CheckResult {
  const applied = new Set(appliedMigrationTags);
  const missing = expectedMigrationTags.filter((tag) => !applied.has(tag));
  const ok = missing.length === 0;
  return {
    check: 'schema-version',
    ok,
    message: ok
      ? `lo schema ha applicato tutte le ${expectedMigrationTags.length} migrazioni attese`
      : 'disallineamento fra codice e database: mancano migrazioni',
    detail: {
      missing,
      appliedCount: appliedMigrationTags.length,
      expectedCount: expectedMigrationTags.length,
    },
  };
}
