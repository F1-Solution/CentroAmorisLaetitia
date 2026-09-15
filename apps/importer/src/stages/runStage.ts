/**
 * Esecutore di una fase (`IMPORTER-DESIGN.md` §4): apre la transazione della
 * fase (`persistence/stageTransaction.ts`), costruisce lo `StageContext`,
 * chiama `stage.run`, e restituisce il conteggio. Non conosce il dominio di
 * nessuna fase: è la parte che i blocchi `1D-W4b`…`1D-W4d` riusano senza
 * riscriverla.
 */
import type { Database } from '@amoris/db';
import type { SourceReader } from '../source/index.js';
import { createIdMap } from '../persistence/idMap.js';
import { runStageTransaction } from '../persistence/stageTransaction.js';
import type { ObjectStore } from '../storage/objectStore.js';
import type { IssueSink } from './types.js';
import type { Mode, StageName, StageResult } from './types.js';
import type { Stage, StageOptions } from './context.js';

export interface RunStageDependencies {
  readonly db: Database;
  readonly source: SourceReader;
  readonly storage: ObjectStore;
  readonly runId: string;
  readonly mode: Mode;
  readonly issues: IssueSink;
  readonly options: StageOptions;
}

export async function runStage(stage: Stage, deps: RunStageDependencies): Promise<StageResult> {
  const ids = createIdMap();
  return runStageTransaction(deps.db, deps.mode, (tx) =>
    stage.run({
      runId: deps.runId,
      mode: deps.mode,
      source: deps.source,
      tx,
      storage: deps.storage,
      ids,
      issues: deps.issues,
      options: deps.options,
    }),
  );
}

/**
 * Rifiuta di eseguire una fase se una delle sue dipendenti non è stata
 * eseguita nella stessa esecuzione (`IMPORTER-DESIGN.md` §4.1): l'ordine
 * obbligato di `importer-spec.md` §4 diventa un dato verificabile.
 */
export function checkDependenciesSatisfied(
  stage: Stage,
  completedStages: ReadonlySet<StageName>,
): { ok: true } | { ok: false; missing: readonly StageName[] } {
  const missing = stage.dependsOn.filter((dep) => !completedStages.has(dep));
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}
