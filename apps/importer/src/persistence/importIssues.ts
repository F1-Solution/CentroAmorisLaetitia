/** Scrittura in `import_issues`, sulla connessione di registro (§5.3). */
import type { Database } from '@amoris/db';
import { schema } from '@amoris/db';
import type { ReportIssue } from '../report/types.js';

export async function recordIssue(
  db: Database,
  runId: string,
  issue: ReportIssue,
): Promise<void> {
  await db.insert(schema.importIssues).values({
    runId,
    severity: issue.severity,
    category: issue.code,
    sourceTable: issue.sourceTable,
    sourceId: issue.sourceId,
    message: issue.code,
    detail: issue.detail ? { note: issue.detail } : {},
  });
}
