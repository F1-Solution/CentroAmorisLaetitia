/**
 * Costruttore di dump SQL sintetici (`IMPORTER-DESIGN.md` §9.2). Deterministico:
 * stesse opzioni, stesso file. Nessun dato reale, nemmeno somigliante: nomi di
 * fantasia, un dominio di esempio.
 *
 * Copre di proposito le insidie di `IMPORTER-DESIGN.md` §3.6: `INSERT` esteso,
 * apici raddoppiati, `\'`, `\\`, `\n`, `NULL`, accenti, emoji a quattro byte.
 */
import { EXPECTED_TABLES } from '../../../src/preflight/constants.js';

export interface SyntheticPostmetaRow {
  readonly meta_id: number;
  readonly post_id: number;
  readonly meta_key: string;
  readonly meta_value: string | null;
}

export interface SyntheticPostRow {
  readonly ID: number;
  readonly post_author: number;
  readonly post_title: string;
  readonly post_content: string;
  readonly post_excerpt: string;
  readonly post_status: string;
  readonly post_name: string;
  readonly post_type: string;
}

export interface BuildDumpOptions {
  /** Le tabelle da dichiarare con `CREATE TABLE`. Default: tutte le 53 attese. */
  readonly tables?: readonly string[];
  readonly posts?: readonly SyntheticPostRow[];
  readonly postmeta?: readonly SyntheticPostmetaRow[];
}

const DEFAULT_POSTS: readonly SyntheticPostRow[] = [
  {
    ID: 1,
    post_author: 1,
    post_title: "L'arte del colloquio",
    post_content:
      "Un testo con l''apostrofo raddoppiato, una \\barra\\, un a-capo\ne un accento città, ed emoji 🎉.",
    post_excerpt: 'Estratto di prova',
    post_status: 'publish',
    post_name: 'arte-del-colloquio',
    post_type: 'page',
  },
  {
    ID: 2,
    post_author: 1,
    post_title: 'Secondo contenuto',
    post_content: 'Contenuto minimo.',
    post_excerpt: '',
    post_status: 'draft',
    post_name: 'secondo-contenuto',
    post_type: 'post',
  },
];

const DEFAULT_POSTMETA: readonly SyntheticPostmetaRow[] = [
  { meta_id: 1, post_id: 1, meta_key: '_wp_attached_file', meta_value: '2026/09/prova.jpg' },
  { meta_id: 2, post_id: 1, meta_key: '_thumbnail_id', meta_value: null },
  { meta_id: 3, post_id: 2, meta_key: '_edit_lock', meta_value: '1700000000:1' },
];

/** Colonne minime per tabella. `wp_posts` e `wp_postmeta` hanno le colonne vere. */
function columnsFor(table: string): readonly string[] {
  if (table === 'wp_posts') {
    return [
      'ID',
      'post_author',
      'post_title',
      'post_content',
      'post_excerpt',
      'post_status',
      'post_name',
      'post_type',
    ];
  }
  if (table === 'wp_postmeta') {
    return ['meta_id', 'post_id', 'meta_key', 'meta_value'];
  }
  return ['id', 'filler'];
}

function escapeSqlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function sqlLiteral(value: string | number | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${escapeSqlString(value)}'`;
}

function createTableStatement(table: string): string {
  const columns = columnsFor(table);
  const columnLines = columns
    .map((c) => `  \`${c}\` text`)
    .concat('  PRIMARY KEY (`' + columns[0] + '`)')
    .join(',\n');
  return `CREATE TABLE \`${table}\` (\n${columnLines}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
}

function insertStatementForPosts(rows: readonly SyntheticPostRow[]): string {
  if (rows.length === 0) return '';
  const columns = columnsFor('wp_posts');
  const tuples = rows.map((row) => {
    const values = [
      row.ID,
      row.post_author,
      row.post_title,
      row.post_content,
      row.post_excerpt,
      row.post_status,
      row.post_name,
      row.post_type,
    ];
    return '(' + values.map((v) => sqlLiteral(v as string | number | null)).join(',') + ')';
  });
  return `INSERT INTO \`wp_posts\` (\`${columns.join('`,`')}\`) VALUES\n${tuples.join(',\n')};`;
}

function insertStatementForPostmeta(rows: readonly SyntheticPostmetaRow[]): string {
  if (rows.length === 0) return '';
  const columns = columnsFor('wp_postmeta');
  const tuples = rows.map((row) => {
    const values: (string | number | null)[] = [
      row.meta_id,
      row.post_id,
      row.meta_key,
      row.meta_value,
    ];
    return '(' + values.map(sqlLiteral).join(',') + ')';
  });
  return `INSERT INTO \`wp_postmeta\` (\`${columns.join('`,`')}\`) VALUES\n${tuples.join(',\n')};`;
}

export function buildSyntheticDump(options: BuildDumpOptions = {}): string {
  const tables = options.tables ?? EXPECTED_TABLES;
  const posts = options.posts ?? DEFAULT_POSTS;
  const postmeta = options.postmeta ?? DEFAULT_POSTMETA;

  const statements: string[] = [
    '-- Dump sintetico, generato da tests/fixtures/builder/buildDump.ts',
    '-- Nessun dato reale: nomi di fantasia, dominio di esempio.',
    'SET NAMES utf8mb4;',
    '/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;',
  ];

  for (const table of tables) {
    statements.push(createTableStatement(table));
    if (table === 'wp_posts') {
      const stmt = insertStatementForPosts(posts);
      if (stmt) statements.push(stmt);
    } else if (table === 'wp_postmeta') {
      const stmt = insertStatementForPostmeta(postmeta);
      if (stmt) statements.push(stmt);
    }
  }

  return statements.join('\n\n') + '\n';
}

export { DEFAULT_POSTS, DEFAULT_POSTMETA };
