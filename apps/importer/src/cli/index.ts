#!/usr/bin/env node
import { ArgsError, parseArgs } from './args.js';
import { createRuntime } from './bootstrap.js';
import { ConfigError } from '../runtime/config.js';
import { runPlan } from './commands/plan.js';
import { runApply } from './commands/apply.js';
import { runVerify } from './commands/verify.js';
import { runReport } from './commands/report.js';
import { runRollback } from './commands/rollback.js';

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (error instanceof ArgsError) {
      console.error(`Errore: ${error.message}`);
      console.error(
        '\nUso: importer <plan|apply|verify|report|rollback> [--stage <nome>] [--only <page|post>] [--verbose] [--confirm] [--run <id>]',
      );
      return 1;
    }
    throw error;
  }

  let runtime;
  try {
    runtime = createRuntime({ verbose: args.verbose });
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }

  try {
    switch (args.command) {
      case 'plan':
        return await runPlan(runtime);
      case 'apply':
        return await runApply(runtime, args);
      case 'verify':
        return await runVerify(runtime);
      case 'report':
        return await runReport(runtime, args);
      case 'rollback':
        return await runRollback(runtime, args);
    }
  } finally {
    await runtime.close();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error('Errore inatteso:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
