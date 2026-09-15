/**
 * `StageContext` e `Stage` (`IMPORTER-DESIGN.md` §4.1). Separato da
 * `stages/types.ts` per evitare un ciclo di importazioni: questo file importa
 * da `persistence/`, che a sua volta importa i tipi semplici da
 * `stages/types.ts`.
 */
import type { SourceReader } from '../source/index.js';
import type { IdMap } from '../persistence/idMap.js';
import type { Tx } from '../persistence/tx.js';
import type { ObjectStore } from '../storage/objectStore.js';
import type { IssueSink, Mode, StageName, StageResult } from './types.js';

export interface StageOptions {
  readonly only: 'page' | 'post' | null;
  readonly forceContentIds: readonly string[];
  readonly verbose: boolean;
}

export interface StageContext {
  readonly runId: string;
  readonly mode: Mode;
  readonly source: SourceReader;
  readonly tx: Tx;
  readonly storage: ObjectStore;
  readonly ids: IdMap;
  readonly issues: IssueSink;
  readonly options: StageOptions;
}

export interface Stage {
  readonly name: StageName;
  readonly dependsOn: readonly StageName[];
  /** Atteso da `database-schema.md` §6, `null` quando non è un intero fisso. */
  expected(ctx: StageContext): Promise<number | null>;
  run(ctx: StageContext): Promise<StageResult>;
}
