/**
 * La fotografia strutturale dello stato del database
 * (`IMPORTER-DESIGN.md` §6.5, `importer-spec.md` §11). È lo strumento con cui
 * si dimostra il criterio di accettazione della fase: **due `apply` di fila
 * producono lo stesso stato**.
 *
 * È un digest per tabella, non un dump di righe. Il motivo non è
 * l'efficienza: un dump di righe conterrebbe dati personali e finirebbe in un
 * file di test o in un messaggio di errore (`database-schema.md` §7 regola 1).
 * Un digest di sedici caratteri dice se due stati coincidono senza dire
 * nulla su che cosa contengano.
 *
 * Tre scelte, e perché:
 *
 * 1. **Le righe si ordinano per il proprio digest, non per chiave.** L'ordine
 *    fisico delle righe cambia fra due esecuzioni senza che cambi lo stato;
 *    ordinare per digest rende la fotografia indipendente da quell'ordine
 *    senza dover conoscere la chiave di ogni tabella.
 * 2. **`created_at` e `updated_at` sono escluse** ovunque: l'importer le
 *    muove lui stesso a ogni riesecuzione (`onConflictDoUpdate` scrive
 *    `updatedAt: new Date()`), quindi due esecuzioni identiche divergerebbero
 *    proprio sulle colonne che non dicono nulla sul contenuto.
 * 3. **Il registro dell'importazione è escluso per intero.** `import_runs`,
 *    `import_issues` e `import_id_map` *devono* cambiare fra la prima e la
 *    seconda esecuzione — la seconda aggiunge una riga di registro e cambia
 *    `action` da `created` a `updated`. Confrontarle direbbe «diverso» per il
 *    motivo sbagliato. Restano invece dentro `sessions`, `audit_log` e
 *    `content_revisions`, che l'importer non tocca mai: includerle è il modo
 *    in cui si prova che non le tocca (`IMPORTER-DESIGN.md` §6.3, ultima riga).
 *
 * I contatori delle sequenze non entrano nella fotografia: `IMPORTER-DESIGN.md`
 * §5.2 punto 1 avverte che avanzano anche quando la transazione è annullata, e
 * confrontarli dichiarerebbe fallito un controllo che è passato.
 */
import { sql } from 'drizzle-orm';
import type { Database } from '@amoris/db';

/** Colonne escluse ovunque: le muove l'importer stesso, non dicono nulla sul contenuto. */
export const IGNORED_COLUMNS: readonly string[] = ['created_at', 'updated_at'];

/** Tabelle escluse: devono cambiare fra due esecuzioni, per costruzione. */
export const IGNORED_TABLES: readonly string[] = [
  'import_runs',
  'import_issues',
  'import_id_map',
  '__drizzle_migrations',
];

export interface TableDigest {
  readonly table: string;
  readonly rows: number;
  /** `md5` dei digest delle righe, ordinati. Vuoto per una tabella vuota. */
  readonly digest: string;
}

export type StateDigest = readonly TableDigest[];

/** I nomi delle tabelle di dominio, in ordine alfabetico. */
export async function domainTables(db: Database): Promise<readonly string[]> {
  const result = await db.execute(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  const rows = result as unknown as readonly { table_name: string }[];
  return rows.map((row) => row.table_name).filter((name) => !IGNORED_TABLES.includes(name));
}

/** La fotografia di una tabella sola. */
export async function tableDigest(db: Database, table: string): Promise<TableDigest> {
  // `to_jsonb(riga) - 'colonna'` toglie la colonna dal confronto senza doverne
  // elencare tutte le altre: una colonna aggiunta domani entra nel digest da
  // sé, che è il comportamento voluto.
  const drops = IGNORED_COLUMNS.map((column) => `- ${quoteLiteral(column)}`).join(' ');
  const result = await db.execute(
    sql.raw(`
      select
        count(*)::int as rows,
        coalesce(md5(string_agg(row_digest, '' order by row_digest)), '') as digest
      from (
        select md5((to_jsonb(t) ${drops})::text) as row_digest
        from ${quoteIdentifier(table)} t
      ) digests
    `),
  );
  const rows = result as unknown as readonly { rows: number; digest: string }[];
  const first = rows[0];
  return { table, rows: first?.rows ?? 0, digest: first?.digest ?? '' };
}

/** La fotografia dell'intero stato: una riga per tabella di dominio. */
export async function stateDigest(db: Database): Promise<StateDigest> {
  const tables = await domainTables(db);
  const digests: TableDigest[] = [];
  for (const table of tables) {
    digests.push(await tableDigest(db, table));
  }
  return digests;
}

export interface DigestDifference {
  readonly table: string;
  readonly before: TableDigest | null;
  readonly after: TableDigest | null;
}

/**
 * Le differenze fra due fotografie. Restituisce i **conteggi e i digest**,
 * mai le righe: un messaggio di errore che elencasse le righe divergenti
 * conterrebbe dati personali (§8.3).
 */
export function diffStateDigests(before: StateDigest, after: StateDigest): readonly DigestDifference[] {
  const byTable = new Map<string, { before?: TableDigest; after?: TableDigest }>();
  for (const item of before) byTable.set(item.table, { before: item });
  for (const item of after) {
    byTable.set(item.table, { ...byTable.get(item.table), after: item });
  }

  const differences: DigestDifference[] = [];
  for (const [table, pair] of byTable) {
    if (pair.before?.digest === pair.after?.digest && pair.before?.rows === pair.after?.rows) continue;
    differences.push({ table, before: pair.before ?? null, after: pair.after ?? null });
  }
  return differences;
}

/** Riassume le differenze in una riga per tabella, adatta a un messaggio di errore. */
export function describeDifferences(differences: readonly DigestDifference[]): string {
  return differences
    .map(
      (d) =>
        `${d.table}: righe ${d.before?.rows ?? '-'} -> ${d.after?.rows ?? '-'}, ` +
        `digest ${short(d.before?.digest)} -> ${short(d.after?.digest)}`,
    )
    .join('\n');
}

function short(digest: string | undefined): string {
  if (!digest) return '(vuoto)';
  return digest.slice(0, 12);
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
