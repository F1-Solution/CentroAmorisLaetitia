/**
 * Le fasi attuate finora, per nome. I blocchi successivi (`1D-W4b`…`1D-W4d`)
 * aggiungono le proprie voci qui, senza toccare quelle già scritte.
 */
import type { Stage } from './context.js';
import type { StageName } from './types.js';
import { settingsStage } from './settings/index.js';
import { usersStage } from './users/index.js';
import { termsStage } from './terms/index.js';
import { mediaStage } from './media/index.js';
import { contentsStage } from './contents/index.js';
import { relationsStage } from './relations/index.js';

export const IMPLEMENTED_STAGES: ReadonlyMap<StageName, Stage> = new Map([
  [settingsStage.name, settingsStage],
  [usersStage.name, usersStage],
  [termsStage.name, termsStage],
  [mediaStage.name, mediaStage],
  [contentsStage.name, contentsStage],
  [relationsStage.name, relationsStage],
]);
