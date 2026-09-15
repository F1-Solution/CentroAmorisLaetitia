/** Interpreta gli argomenti della riga di comando (`importer-spec.md` §3). */
export type Command = 'plan' | 'apply' | 'verify' | 'report' | 'rollback';

export interface ParsedArgs {
  readonly command: Command;
  readonly confirm: boolean;
  readonly stage: string | null;
  readonly only: 'page' | 'post' | null;
  readonly verbose: boolean;
  readonly run: string | null;
  readonly forceContent: readonly string[];
}

export class ArgsError extends Error {}

const COMMANDS: readonly Command[] = ['plan', 'apply', 'verify', 'report', 'rollback'];

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const [rawCommand, ...rest] = argv;
  if (!rawCommand || !COMMANDS.includes(rawCommand as Command)) {
    throw new ArgsError(
      `comando sconosciuto: ${rawCommand ?? '(nessuno)'}. Comandi validi: ${COMMANDS.join(', ')}`,
    );
  }
  const command = rawCommand as Command;

  let confirm = false;
  let stage: string | null = null;
  let only: 'page' | 'post' | null = null;
  let verbose = false;
  let run: string | null = null;
  const forceContent: string[] = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]!;
    switch (arg) {
      case '--confirm':
        confirm = true;
        break;
      case '--verbose':
        verbose = true;
        break;
      case '--stage':
        stage = rest[++i] ?? null;
        if (!stage) throw new ArgsError('--stage richiede un valore');
        break;
      case '--only': {
        const value = rest[++i];
        if (value !== 'page' && value !== 'post') {
          throw new ArgsError("--only richiede 'page' o 'post'");
        }
        only = value;
        break;
      }
      case '--run':
        run = rest[++i] ?? null;
        if (!run) throw new ArgsError('--run richiede un valore');
        break;
      case '--force-content': {
        const value = rest[++i];
        if (!value) throw new ArgsError('--force-content richiede un valore');
        forceContent.push(value);
        break;
      }
      default:
        throw new ArgsError(`opzione sconosciuta: ${arg}`);
    }
  }

  if ((command === 'report' || command === 'rollback') && !run) {
    throw new ArgsError(`${command} richiede --run <id>`);
  }

  return { command, confirm, stage, only, verbose, run, forceContent };
}
