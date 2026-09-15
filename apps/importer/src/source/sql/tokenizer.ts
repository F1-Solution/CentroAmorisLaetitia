/**
 * Tokenizzatore del dump SQL — `IMPORTER-DESIGN.md` §3.6, strada (a): nessun
 * MySQL, nessuna dipendenza in piu'. Legge il testo, lo divide per istruzione,
 * riconosce `CREATE TABLE` e `INSERT INTO`, e produce righe con nome di
 * colonna.
 */
import { extractParenBody, parseTuples, splitStatements, splitTopLevel } from './scanner.js';
import type { Dump, DumpIssue, SqlRow, SqlValue } from './types.js';

const CREATE_TABLE_RE = /^CREATE TABLE\s+`([^`]+)`\s*/i;
const INSERT_RE = /^INSERT INTO\s+`([^`]+)`\s*(\(([^)]*)\))?\s*VALUES\s*/i;

function parseCreateTableColumns(body: string): string[] {
  const columns: string[] = [];
  for (const rawSegment of splitTopLevel(body)) {
    const segment = rawSegment.trim();
    // le righe di colonna cominciano con `` `nome` ``; le righe di chiave e
    // vincolo cominciano con una parola chiave (PRIMARY, KEY, UNIQUE, CONSTRAINT, ...)
    const match = /^`([^`]+)`/.exec(segment);
    if (match) columns.push(match[1]!);
  }
  return columns;
}

/**
 * Analizza il testo del dump e restituisce tabelle e righe.
 *
 * Le sequenze non valide UTF-8 sono già state sostituite dal decodificatore a
 * monte (vedi `readDumpFile`): qui si producono soltanto le righe `warning`
 * corrispondenti, quando il chiamante passa `invalidUtf8Locations`.
 */
export function parseDump(sql: string): Dump {
  const statements = splitStatements(sql);
  const tables = new Map<string, readonly string[]>();
  const rows = new Map<string, SqlRow[]>();
  const issues: DumpIssue[] = [];

  // Prima passata: tutti i CREATE TABLE, per avere le colonne pronte prima
  // di leggere qualunque INSERT (l'ordine nel dump le mette comunque prima,
  // ma non ci si affida all'ordine).
  for (const statement of statements) {
    const createMatch = CREATE_TABLE_RE.exec(statement);
    if (!createMatch) continue;
    const tableName = createMatch[1]!;
    const afterName = statement.slice(createMatch[0].length);
    const { body } = extractParenBody(afterName, 0);
    tables.set(tableName, parseCreateTableColumns(body));
  }

  // Seconda passata: tutti gli INSERT.
  for (const statement of statements) {
    const insertMatch = INSERT_RE.exec(statement);
    if (!insertMatch) continue;
    const tableName = insertMatch[1]!;
    const explicitColumnList = insertMatch[3];
    const columns = explicitColumnList
      ? splitTopLevel(explicitColumnList).map((c) => c.trim().replace(/^`|`$/g, ''))
      : (tables.get(tableName) ?? []);

    if (columns.length === 0) {
      issues.push({ severity: 'error', table: tableName, code: 'unclassified-value-form' });
      continue;
    }

    const valuesBody = statement.slice(insertMatch[0].length).replace(/;?\s*$/, '');
    const tuples = parseTuples(valuesBody);

    const tableRows = rows.get(tableName) ?? [];
    for (const tuple of tuples) {
      const row: Record<string, SqlValue> = {};
      for (let index = 0; index < columns.length; index += 1) {
        row[columns[index]!] = tuple[index] ?? null;
      }
      tableRows.push(row);
    }
    rows.set(tableName, tableRows);
  }

  return { tables, rows, issues };
}
