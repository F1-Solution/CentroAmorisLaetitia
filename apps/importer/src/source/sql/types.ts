/** Tipi del lettore del dump SQL (`IMPORTER-DESIGN.md` §3). */

/** Un valore di colonna, cosi' come esce dal tokenizzatore. */
export type SqlValue = string | number | null;

/** Una riga letta da un `INSERT`, con i nomi di colonna del `CREATE TABLE`. */
export type SqlRow = Readonly<Record<string, SqlValue>>;

export interface DumpIssue {
  readonly severity: 'warning' | 'error';
  readonly table: string;
  readonly column?: string;
  /** Codice da vocabolario chiuso — mai un frammento del valore sorgente. */
  readonly code: 'invalid-utf8-byte' | 'unclassified-value-form';
}

export interface Dump {
  /** Tabella -> colonne, nell'ordine dichiarato dal `CREATE TABLE`. */
  readonly tables: ReadonlyMap<string, readonly string[]>;
  /** Tabella -> righe lette dagli `INSERT`. */
  readonly rows: ReadonlyMap<string, readonly SqlRow[]>;
  readonly issues: readonly DumpIssue[];
}
