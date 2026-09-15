/**
 * `IssueSink` (`stages/types.ts`): in `apply` scrive su `import_issues` sulla
 * connessione di registro (`db`, mai `tx`: `IMPORTER-DESIGN.md` §5.3); in
 * `plan` resta solo in memoria (§5.2 punto 2). `collected` alimenta il
 * rapporto in entrambi i casi.
 */
import type { Database } from '@amoris/db';
import { recordIssue } from './importIssues.js';
import type { IssueSink, Mode } from '../stages/types.js';
import type { ReportIssue } from '../report/types.js';

export function createIssueSink(db: Database, mode: Mode, runId: string): IssueSink {
  const collected: ReportIssue[] = [];
  return {
    async record(issue) {
      collected.push(issue);
      if (mode === 'apply') {
        await recordIssue(db, runId, issue);
      }
    },
    collected,
  };
}
