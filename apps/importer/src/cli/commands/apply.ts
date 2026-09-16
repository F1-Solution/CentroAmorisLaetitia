import type { Runtime } from '../bootstrap.js';
import type { ParsedArgs } from '../args.js';
import { runImportCommand } from './runImportCommand.js';

/**
 * `importer apply --confirm` — scrive. Senza `--confirm` **non scrive nulla**
 * (`importer-spec.md` §3): è la stessa logica delle conferme obbligatorie di
 * `CLAUDE.md`.
 */
export async function runApply(runtime: Runtime, args: ParsedArgs): Promise<number> {
  if (!args.confirm) {
    console.error(
      'apply richiede --confirm: senza, non scrive nulla. Per una prova senza scrivere: importer plan. ' +
        'Per eseguire davvero: importer apply --confirm',
    );
    return 1;
  }
  return runImportCommand(runtime, args, 'apply');
}
