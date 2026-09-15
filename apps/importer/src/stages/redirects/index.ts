/**
 * Fase 14 `redirects` (`importer-spec.md` §4, §6.2): produce `redirects` —
 * 180 righe attese (`wp-to-postgres-mapping.md` §3.2).
 *
 * Le righe che questa fase scrive hanno sempre `origin = 'migration'` e
 * vengono **ricalcolate** a ogni riesecuzione: quelle di `origin = 'manual'`
 * (e quelle di `origin = 'automatic'`, che il CMS creerà da sé quando uno
 * slug cambia) **non si toccano mai** — se occupano già il percorso sorgente
 * di una regola calcolata qui, quella regola si scarta con un `import_issues`
 * invece di sovrascrivere (`importer-spec.md` §6.2).
 *
 * Un candidato la cui destinazione non si risolve (l'allegato senza riga
 * `media`, lo slug storico di un `wpforms`) o che punterebbe a sé stesso
 * (vietato dal vincolo `redirects_no_self_loop`) non si scrive: diventa un
 * `import_issues` di gravità `warning`, mai un errore che ferma la fase.
 */
import { and, eq, notInArray } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { Tx } from '../../persistence/tx.js';
import { buildRedirectCandidates, type RedirectCandidate } from './rules.js';

/** Solo le regole con una destinazione risolta e senza anello restano "desiderate" da questa fase. */
function isResolved(candidate: RedirectCandidate): boolean {
  return candidate.targetPath !== null && candidate.targetPath !== candidate.sourcePath;
}

/**
 * Rimuove le righe `origin = 'migration'` il cui `sourcePath` non compare più
 * fra i candidati risolti di questa esecuzione: è la parte "ricalcolate" del
 * comportamento di `importer-spec.md` §6.2, fatta in un colpo solo invece che
 * candidato per candidato.
 */
async function deleteStaleMigrationRows(tx: Tx, keepSourcePaths: readonly string[]): Promise<void> {
  if (keepSourcePaths.length === 0) {
    await tx.delete(schema.redirects).where(eq(schema.redirects.origin, 'migration'));
    return;
  }
  await tx
    .delete(schema.redirects)
    .where(
      and(
        eq(schema.redirects.origin, 'migration'),
        notInArray(schema.redirects.sourcePath, keepSourcePaths as string[]),
      ),
    );
}

export const redirectsStage: Stage = {
  name: 'redirects',
  dependsOn: ['contents', 'media', 'documents'],

  async expected(ctx: StageContext) {
    const candidates = await buildRedirectCandidates(ctx);
    return candidates.filter(isResolved).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const candidates = await buildRedirectCandidates(ctx);
    const resolved = candidates.filter(isResolved);
    await deleteStaleMigrationRows(
      ctx.tx,
      resolved.map((c) => c.sourcePath),
    );

    return forEachItem(
      ctx.tx,
      candidates,
      (candidate): ItemKey => candidate.key,
      async (candidate, tx) => {
        if (candidate.targetPath === null) {
          await ctx.issues.record({
            severity: 'warning',
            stage: 'redirects',
            code: 'redirect-unresolved-target',
            sourceTable: candidate.key.sourceTable,
            sourceId: candidate.key.sourceId,
            detail: candidate.unresolvedReason,
          });
          return 'skipped';
        }

        if (candidate.targetPath === candidate.sourcePath) {
          await ctx.issues.record({
            severity: 'warning',
            stage: 'redirects',
            code: 'redirect-self-loop',
            sourceTable: candidate.key.sourceTable,
            sourceId: candidate.key.sourceId,
            detail: 'source-equals-target',
          });
          return 'skipped';
        }

        const [existing] = await tx
          .select({ origin: schema.redirects.origin })
          .from(schema.redirects)
          .where(eq(schema.redirects.sourcePath, candidate.sourcePath));

        if (existing && existing.origin !== 'migration') {
          await ctx.issues.record({
            severity: 'info',
            stage: 'redirects',
            code: 'redirect-protected-by-manual',
            sourceTable: candidate.key.sourceTable,
            sourceId: candidate.key.sourceId,
            detail: existing.origin,
          });
          return 'skipped';
        }

        await tx
          .insert(schema.redirects)
          .values({
            sourcePath: candidate.sourcePath,
            targetPath: candidate.targetPath,
            statusCode: 301,
            kind: candidate.kind,
            origin: 'migration',
            note: candidate.note,
          })
          .onConflictDoUpdate({
            target: schema.redirects.sourcePath,
            set: {
              targetPath: candidate.targetPath,
              statusCode: 301,
              kind: candidate.kind,
              origin: 'migration',
              note: candidate.note,
              updatedAt: new Date(),
            },
          });

        return existing ? 'updated' : 'created';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'redirects',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );
  },
};
