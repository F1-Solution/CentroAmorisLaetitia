import type { Runtime } from '../bootstrap.js';
import type { ParsedArgs } from '../args.js';
import { runImportCommand } from './runImportCommand.js';

/**
 * `importer plan` — esegue tutto senza scrivere, produce il rapporto
 * (`importer-spec.md` §3). Non chiama mai `createRun`/`recordIssue`: in modo
 * `plan` non si scrive nulla in `import_runs` né in `import_issues`
 * (`IMPORTER-DESIGN.md` §5.2).
 */
export async function runPlan(runtime: Runtime, args: ParsedArgs): Promise<number> {
  return runImportCommand(runtime, args, 'plan');
}
