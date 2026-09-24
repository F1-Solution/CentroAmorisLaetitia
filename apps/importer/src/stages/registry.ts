/**
 * Le fasi attuate, per nome. Dalla wave `1D-W5b` sono tutte e sedici, nello
 * stesso ordine obbligato di `importer-spec.md` §4.
 *
 * **L'ordine di questa mappa è l'ordine di esecuzione** (`run/orchestrator.ts`
 * itera i valori). Dal 2026-09-24 attua **DR-062**: `documents`, `sliders` e
 * `forms` stanno prima di `contents`, così che i risolutori di
 * `contents/entityResolvers.ts` esistano quando il convertitore incontra un
 * riferimento a un documento o a un modulo form.
 */
import type { Stage } from './context.js';
import type { StageName } from './types.js';
import { settingsStage } from './settings/index.js';
import { usersStage } from './users/index.js';
import { termsStage } from './terms/index.js';
import { mediaStage } from './media/index.js';
import { contentsStage } from './contents/index.js';
import { relationsStage } from './relations/index.js';
import { menusStage } from './menus/index.js';
import { seoStage } from './seo/index.js';
import { documentsStage } from './documents/index.js';
import { slidersStage } from './sliders/index.js';
import { formsStage } from './forms/index.js';
import { submissionsStage } from './submissions/index.js';
import { legacyStage } from './legacy/index.js';
import { redirectsStage } from './redirects/index.js';
import { rewriteStage } from './rewrite/index.js';
import { verifyStage } from './verify/index.js';

export const IMPLEMENTED_STAGES: ReadonlyMap<StageName, Stage> = new Map([
  [settingsStage.name, settingsStage],
  [usersStage.name, usersStage],
  [mediaStage.name, mediaStage],
  [termsStage.name, termsStage],
  [documentsStage.name, documentsStage],
  [slidersStage.name, slidersStage],
  [formsStage.name, formsStage],
  [contentsStage.name, contentsStage],
  [relationsStage.name, relationsStage],
  [menusStage.name, menusStage],
  [seoStage.name, seoStage],
  [submissionsStage.name, submissionsStage],
  [legacyStage.name, legacyStage],
  [redirectsStage.name, redirectsStage],
  [rewriteStage.name, rewriteStage],
  [verifyStage.name, verifyStage],
]);
