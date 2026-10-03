/**
 * Fase 16 `verify` (`importer-spec.md` §4, §8): il rapporto finale. Non
 * scrive dati di dominio — **misura**: le otto righe «VERIFICHE» di §8.1
 * ({@link runAllChecks}) e i volumi di tabella di `database-schema.md` §6
 * ({@link measureTableCounts}), distinti dai conteggi per fase.
 *
 * Ogni scostamento — una verifica non superata o un conteggio di tabella che
 * non torna — diventa un `import_issues` e conta come un errore della fase:
 * cosi' l'esito complessivo non può essere `success` mentre un numero non
 * coincide, anche se nessun elemento ha prodotto un errore proprio
 * (`importer-spec.md` §8.2). Una verifica **non eseguibile** (il bucket nel
 * `plan` completo, o l'archiviazione irraggiungibile) è un avviso, non un
 * errore, e non risulta mai "passata".
 */
import type { Stage, StageContext } from '../context.js';
import type { StageResult } from '../types.js';
import { runAllChecks } from './checks.js';
import { measureMediaVariantsEstimate, measureTableCounts } from './tableCounts.js';

export const verifyStage: Stage = {
  name: 'verify',
  dependsOn: [
    'settings',
    'users',
    'media',
    'terms',
    'contents',
    'relations',
    'menus',
    'seo',
    'documents',
    'sliders',
    'forms',
    'submissions',
    'legacy',
    'redirects',
    'rewrite',
  ],

  async expected() {
    // Non produce righe: nessun conteggio da attendersi, come `rewrite`.
    return null;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const checks = await runAllChecks(ctx);
    const tableCounts = await measureTableCounts(ctx);
    // Misurata e riportata a fianco, ma non entra nel conteggio degli
    // scostamenti: `wp-to-postgres-mapping.md` §3.4 la dichiara una stima.
    await measureMediaVariantsEstimate(ctx);

    let errors = 0;
    let skipped = 0;

    for (const item of checks) {
      if (!item.executed) {
        skipped += 1;
        await ctx.issues.record({
          severity: 'warning',
          stage: 'verify',
          code: 'verification-check-not-executed',
          sourceTable: 'verify',
          sourceId: 0,
          detail: item.check,
        });
        continue;
      }
      if (!item.ok) {
        errors += 1;
        await ctx.issues.record({
          severity: 'error',
          stage: 'verify',
          code: 'verification-check-failed',
          sourceTable: 'verify',
          sourceId: item.value,
          detail: item.check,
        });
      }
    }

    for (const row of tableCounts) {
      if (row.ok) continue;
      errors += 1;
      await ctx.issues.record({
        severity: 'error',
        stage: 'verify',
        code: 'table-count-mismatch',
        sourceTable: row.table,
        sourceId: row.value,
        detail: row.table,
      });
    }

    // `checks` risale al rapporto: le otto righe VERIFICHE di
    // `importer-spec.md` §8.1 sono misurate qui e da nessun'altra parte, e
    // dopo questa transazione non sarebbero piu' misurabili in `plan`.
    return { created: 0, updated: 0, skipped, errors, checks };
  },
};
