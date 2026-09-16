/**
 * L'esecutore di un'intera importazione: le sedici fasi di dominio nell'ordine
 * obbligato di `importer-spec.md` §4, con una sola `IdMap` e un solo rapporto.
 *
 * Nasce nella wave `1D-W5c` per chiudere il rilievo di `IMPORTER-DESIGN.md`
 * §11.8: fino a qui le fasi esistevano e funzionavano, ma `plan` e `apply`
 * eseguivano ancora l'abbozzo della `1D-W2` e non dimostravano nulla di ciò
 * che le fasi fanno.
 *
 * Due scelte che meritano di essere dette, perché scostano da come
 * `IMPORTER-DESIGN.md` §5.1 e §6.1 si leggono a prima vista.
 *
 * 1. **Una sola `IdMap` per esecuzione, non una per fase.** §6.1 lo dice già
 *    («la mappa in memoria lo ricorda per la durata dell'intera esecuzione»),
 *    ma `runStage` ne creava una nuova a ogni chiamata, perché nella `1D-W4a`
 *    le fasi si eseguivano una per volta dai test. Con una mappa per fase, in
 *    `plan` la fase `relations` non troverebbe i contenuti che `contents` ha
 *    appena creato, e conterebbe zero.
 *
 * 2. **In `plan`, una transazione per l'intera esecuzione**, con un savepoint
 *    per fase; in `apply`, una transazione per fase come vuole §5.1. Il motivo
 *    di §5.1 — un errore alla fase 16 non deve cancellare il lavoro delle 15
 *    precedenti — riguarda `apply`, dove il lavoro resta. In `plan` viene
 *    annullato tutto per definizione, e transazioni separate avrebbero l'effetto
 *    opposto a quello voluto: ogni fase non vedrebbe le righe della precedente,
 *    e `plan` riporterebbe conteggi falsi proprio per le fasi dipendenti. Il
 *    savepoint per fase conserva comunque l'isolamento fra fasi.
 */
import type { Database } from '@amoris/db';
import { createIdMap } from '../persistence/idMap.js';
import type { SourceReader } from '../source/index.js';
import type { ObjectStore } from '../storage/objectStore.js';
import type { Stage, StageOptions } from '../stages/context.js';
import { IMPLEMENTED_STAGES } from '../stages/registry.js';
import { checkDependenciesSatisfied } from '../stages/runStage.js';
import type { IssueSink, Mode, StageName, StageResult } from '../stages/types.js';
import type { Tx } from '../persistence/tx.js';

const PLAN_ROLLBACK = Symbol('rollback deliberato del modo plan');

export interface OrchestratorOptions {
  readonly db: Database;
  readonly source: SourceReader;
  readonly storage: ObjectStore;
  readonly runId: string;
  readonly mode: Mode;
  readonly issues: IssueSink;
  readonly options: StageOptions;
  readonly ipHashSalt: string | null;
  /**
   * `--stage <nome>`: riesegue una fase sola dopo averla corretta
   * (`importer-spec.md` §9, prima riga). Il controllo delle dipendenze si
   * salta, perché sono state soddisfatte da un'esecuzione precedente e non da
   * questa: lo si dichiara nel rapporto invece di fingere che siano state
   * verificate.
   */
  readonly onlyStage?: StageName | null;
  /** Riceve ogni fase appena conclusa, per il registro a terminale. */
  readonly onStageDone?: (stage: StageName, result: StageResult) => void;
  /**
   * L'insieme delle fasi da eseguire. Omesso, è il registro
   * (`stages/registry.ts`), che è il caso di ogni esecuzione vera. I test del
   * contratto dell'orchestratore — ordine, dipendenze, isolamento — lo
   * sostituiscono con fasi finte, perché quel contratto vale a prescindere da
   * che cosa le fasi facciano.
   */
  readonly stages?: readonly Stage[];
}

export interface OrchestratorResult {
  readonly results: ReadonlyMap<StageName, StageResult>;
  /**
   * La fase che ha interrotto l'esecuzione, se ce n'è stata una. Un errore che
   * arriva fin qui non è l'errore di un elemento — quelli sono isolati dentro
   * la fase (`IMPORTER-DESIGN.md` §4.2) — ma il fallimento della fase intera,
   * e l'esito dell'esecuzione è `failed`.
   */
  readonly aborted: { readonly stage: StageName; readonly reason: string } | null;
  /** Fasi non eseguite perché una loro dipendente non era stata eseguita. */
  readonly skippedStages: readonly StageName[];
}

/** Le fasi da eseguire, nell'ordine obbligato, tolta `preflight` che ha il proprio comando. */
function stagesToRun(all: readonly Stage[], onlyStage: StageName | null): readonly Stage[] {
  if (onlyStage === null) return all;
  const one = all.find((stage) => stage.name === onlyStage);
  return one ? [one] : [];
}

export async function runImport(opts: OrchestratorOptions): Promise<OrchestratorResult> {
  const onlyStage = opts.onlyStage ?? null;
  const allStages = opts.stages ?? [...IMPLEMENTED_STAGES.values()];
  const stages = stagesToRun(allStages, onlyStage);
  if (onlyStage !== null && stages.length === 0) {
    return {
      results: new Map(),
      aborted: { stage: onlyStage, reason: 'fase sconosciuta' },
      skippedStages: [],
    };
  }

  // Una sola per esecuzione: vedi il punto 1 dell'intestazione.
  const ids = createIdMap();
  const results = new Map<StageName, StageResult>();
  const skippedStages: StageName[] = [];
  let aborted: OrchestratorResult['aborted'] = null;

  // `preflight` non è fra le fasi eseguite qui, ma le altre lo dichiarano come
  // dipendenza: è già stato eseguito dal comando prima di arrivare qui.
  const completed = new Set<StageName>(['preflight']);
  if (onlyStage !== null) {
    // Riesecuzione di una fase sola: le dipendenti vengono da prima.
    for (const stage of allStages) completed.add(stage.name);
  }

  const runOne = async (stage: Stage, tx: Tx): Promise<void> => {
    const result = await stage.run({
      runId: opts.runId,
      mode: opts.mode,
      source: opts.source,
      tx,
      storage: opts.storage,
      ids,
      issues: opts.issues,
      options: opts.options,
      ipHashSalt: opts.ipHashSalt,
    });
    results.set(stage.name, result);
    completed.add(stage.name);
    opts.onStageDone?.(stage.name, result);
  };

  /** Esegue la sequenza. `openStageTx` decide la forma della transazione di fase. */
  const runSequence = async (
    openStageTx: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>,
  ): Promise<void> => {
    for (const stage of stages) {
      const deps = checkDependenciesSatisfied(stage, completed);
      if (!deps.ok) {
        skippedStages.push(stage.name);
        continue;
      }
      try {
        await openStageTx((tx) => runOne(stage, tx));
      } catch (error) {
        aborted = {
          stage: stage.name,
          reason: error instanceof Error ? error.name : 'unknown-error',
        };
        await opts.issues.record({
          severity: 'error',
          stage: stage.name,
          code: 'item-import-failed',
          sourceTable: stage.name,
          sourceId: 0,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
        // Una fase fallita non ferma le altre: `importer-spec.md` §9 prima
        // riga vuole che la si corregga e la si rilanci da sola. Le fasi che
        // dipendono da questa si fermeranno da sole al controllo qui sopra.
      }
    }
  };

  if (opts.mode === 'apply') {
    await runSequence((fn) => opts.db.transaction((tx) => fn(tx)));
    return { results, aborted, skippedStages };
  }

  // `plan`: una transazione per l'esecuzione, un savepoint per fase, e
  // `ROLLBACK` alla fine qualunque cosa succeda. Vedi il punto 2.
  try {
    await opts.db.transaction(async (outer) => {
      await runSequence((fn) => outer.transaction((savepoint) => fn(savepoint)));
      throw PLAN_ROLLBACK;
    });
  } catch (error) {
    if (error !== PLAN_ROLLBACK) throw error;
  }
  return { results, aborted, skippedStages };
}
