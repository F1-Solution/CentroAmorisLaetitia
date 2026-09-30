/**
 * La protezione del lavoro redazionale (`importer-spec.md` §6.3,
 * `IMPORTER-DESIGN.md` §6.4 e §11.2). Criterio, già stabilito e qui solo
 * attuato:
 *
 * > Un contenuto è stato modificato da un redattore dopo l'ultima esecuzione
 * > riuscita se e solo se esiste una riga in `content_revisions` con
 * > `created_at` successivo a `import_runs.finished_at` dell'ultima
 * > esecuzione con esito `success` o `partial`.
 *
 * Dal 2026-09-30 vale anche una copia di lavoro (`content_drafts`, DR-068) con
 * `updated_at` successivo alla stessa ora: il salvataggio automatico
 * dell'editor scrive solo lì.
 *
 * Nessuna modifica allo schema approvato in Fase 1B: si legge
 * `content_revisions`, che esiste già e che l'importer non scrive mai
 * (`importer-spec.md` §6.2, ultima riga).
 */
import { and, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Tx } from '../../persistence/tx.js';

/** L'ora di fine dell'ultima esecuzione riuscita, o `null` se non ce n'è mai stata una. */
export async function lastSuccessfulRunFinishedAt(tx: Tx): Promise<Date | null> {
  const [row] = await tx
    .select({ finishedAt: schema.importRuns.finishedAt })
    .from(schema.importRuns)
    .where(
      and(
        isNotNull(schema.importRuns.finishedAt),
        inArray(schema.importRuns.outcome, ['success', 'partial']),
      ),
    )
    .orderBy(desc(schema.importRuns.finishedAt))
    .limit(1);
  return row?.finishedAt ?? null;
}

/**
 * Vero se `contentId` ha almeno una riga di cronologia redazionale, o una
 * copia di lavoro, più recente di `since`. `contentId` è `null` quando il contenuto non esiste
 * ancora (prima creazione): in quel caso non può esserci stata una modifica
 * redazionale successiva a un'esecuzione che non lo conosceva.
 */
export async function hasEditorialWorkSince(
  tx: Tx,
  contentId: string | null,
  since: Date | null,
): Promise<boolean> {
  if (contentId === null || since === null) return false;
  const [revision] = await tx
    .select({ id: schema.contentRevisions.id })
    .from(schema.contentRevisions)
    .where(
      and(
        eq(schema.contentRevisions.contentId, contentId),
        gt(schema.contentRevisions.createdAt, since),
      ),
    )
    .limit(1);
  if (revision) return true;
  const [draft] = await tx
    .select({ id: schema.contentDrafts.id })
    .from(schema.contentDrafts)
    .where(
      and(eq(schema.contentDrafts.contentId, contentId), gt(schema.contentDrafts.updatedAt, since)),
    )
    .limit(1);
  return draft !== undefined;
}

/** `--force-content <id>`: un contenuto per volta, mai un `--force-all` (`importer-spec.md` §6.3 punto 2). */
export function isForced(
  forceContentIds: readonly string[],
  existingContentId: string | null,
  legacyId: number,
): boolean {
  if (existingContentId && forceContentIds.includes(existingContentId)) return true;
  return forceContentIds.includes(String(legacyId));
}
