/**
 * Utilita' di basso livello per il tokenizzatore: separare le istruzioni,
 * dividere elenchi al primo livello di parentesi, leggere una stringa fra
 * apici con le sue sequenze di escape.
 *
 * Il file legge il dump per intero in memoria e lo scorre **per istruzione**,
 * non per riga (`IMPORTER-DESIGN.md` §3.6): una singola riga del dump reale
 * arriva a 1,7 milioni di caratteri.
 */
import type { SqlValue } from './types.js';

const WHITESPACE = /\s/;

/** Divide il testo del dump in istruzioni, terminate da `;` fuori da stringhe e commenti. */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let i = 0;
  const n = sql.length;
  let inLineComment = false;
  let inBlockComment = false;
  let inString: "'" | '"' | null = null;

  while (i < n) {
    const c = sql[i]!;
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && sql[i + 1] === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        i += 2; // salta il carattere sfuggito, qualunque sia
        continue;
      }
      if (c === inString) {
        // apice raddoppiato: resta dentro la stringa
        if (sql[i + 1] === inString) {
          i += 2;
          continue;
        }
        inString = null;
        i++;
        continue;
      }
      i++;
      continue;
    }
    // fuori da stringhe e commenti
    if (c === '-' && sql[i + 1] === '-' && (sql[i + 2] === ' ' || sql[i + 2] === '\n')) {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      inString = c;
      i++;
      continue;
    }
    if (c === ';') {
      const statement = sql.slice(start, i).trim();
      if (statement.length > 0) statements.push(statement);
      i++;
      start = i;
      continue;
    }
    i++;
  }
  const last = sql.slice(start).trim();
  if (last.length > 0) statements.push(last);
  return statements;
}

/** Divide `text` sulla virgola, rispettando la profondita' delle parentesi e le stringhe fra apici. */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i]!;
    if (inString) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === "'") {
        if (text[i + 1] === "'") {
          i += 2;
          continue;
        }
        inString = false;
      }
      i++;
      continue;
    }
    if (c === "'") {
      inString = true;
      i++;
      continue;
    }
    if (c === '(') {
      depth++;
      i++;
      continue;
    }
    if (c === ')') {
      depth--;
      i++;
      continue;
    }
    if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      i++;
      start = i;
      continue;
    }
    i++;
  }
  parts.push(text.slice(start));
  return parts;
}

/** Estrae il contenuto fra la prima `(` e la sua `)` corrispondente, a partire da `fromIndex`. */
export function extractParenBody(
  text: string,
  fromIndex: number,
): { body: string; endIndex: number } {
  let i = text.indexOf('(', fromIndex);
  if (i === -1) throw new Error('nessuna parentesi aperta trovata dopo la posizione indicata');
  const start = i + 1;
  let depth = 1;
  i = start;
  let inString = false;
  const n = text.length;
  while (i < n && depth > 0) {
    const c = text[i]!;
    if (inString) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === "'") {
        if (text[i + 1] === "'") {
          i += 2;
          continue;
        }
        inString = false;
      }
      i++;
      continue;
    }
    if (c === "'") {
      inString = true;
      i++;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    i++;
  }
  return { body: text.slice(start, i - 1), endIndex: i };
}

const ESCAPE_MAP: Record<string, string> = {
  '0': '\0',
  b: '\b',
  n: '\n',
  r: '\r',
  t: '\t',
  Z: '\x1a',
  "'": "'",
  '"': '"',
  '\\': '\\',
};

/**
 * Legge una stringa fra apici singoli a partire dall'apice di apertura in
 * `text[i]`. Riconosce le sequenze di escape di MySQL (`IMPORTER-DESIGN.md`
 * §3.6). `\%` e `\_` si conservano **come due caratteri**: nei contesti `LIKE`
 * la barra resta fuori, e convertirli cambierebbe il dato.
 */
export function parseQuotedString(text: string, i: number): [value: string, next: number] {
  let j = i + 1; // salta l'apice di apertura
  let out = '';
  const n = text.length;
  while (j < n) {
    const c = text[j]!;
    if (c === '\\') {
      const escaped = text[j + 1];
      if (escaped === '%' || escaped === '_') {
        out += '\\' + escaped;
      } else if (escaped !== undefined && escaped in ESCAPE_MAP) {
        out += ESCAPE_MAP[escaped];
      } else {
        // sequenza non riconosciuta: MySQL scarta la barra e tiene il carattere
        out += escaped ?? '';
      }
      j += 2;
      continue;
    }
    if (c === "'") {
      if (text[j + 1] === "'") {
        out += "'";
        j += 2;
        continue;
      }
      j++; // apice di chiusura
      break;
    }
    out += c;
    j++;
  }
  return [out, j];
}

/** Legge un valore (`NULL`, numero, stringa fra apici, letterale esadecimale) a partire da `i`. */
export function parseValue(text: string, i: number): [value: SqlValue, next: number] {
  let j = i;
  while (j < text.length && WHITESPACE.test(text[j]!)) j++;
  const c = text[j];

  if (c === "'") return parseQuotedString(text, j);

  if (text.startsWith('NULL', j) && !isWordChar(text[j + 4])) {
    return [null, j + 4];
  }

  if (
    (text[j] === '0' && (text[j + 1] === 'x' || text[j + 1] === 'X')) ||
    (text[j] === 'x' && text[j + 1] === "'")
  ) {
    // letterale esadecimale 0x... — si conserva come testo, senza interpretarlo
    const hexStart = j;
    j += 2;
    while (j < text.length && /[0-9a-fA-F]/.test(text[j]!)) j++;
    return [text.slice(hexStart, j), j];
  }

  // numero: intero o decimale, con segno facoltativo
  const numberMatch = /^-?\d+(\.\d+)?/.exec(text.slice(j));
  if (numberMatch) {
    const raw = numberMatch[0];
    j += raw.length;
    return [Number(raw), j];
  }

  throw new Error(
    `valore non riconosciuto alla posizione ${j}: ${JSON.stringify(text.slice(j, j + 20))}`,
  );
}

function isWordChar(c: string | undefined): boolean {
  if (c === undefined) return false;
  return /[A-Za-z0-9_]/.test(c);
}

/** Legge le tuple `(...),(...),...` di un `INSERT ... VALUES`. */
export function parseTuples(valuesBody: string): SqlValue[][] {
  const tuples: SqlValue[][] = [];
  let i = 0;
  const n = valuesBody.length;
  while (i < n) {
    while (i < n && (WHITESPACE.test(valuesBody[i]!) || valuesBody[i] === ',')) i++;
    if (i >= n) break;
    if (valuesBody[i] !== '(') {
      throw new Error(`atteso '(' alla posizione ${i} di una tupla di INSERT`);
    }
    i++;
    const values: SqlValue[] = [];
    for (;;) {
      while (i < n && WHITESPACE.test(valuesBody[i]!)) i++;
      const [value, next] = parseValue(valuesBody, i);
      values.push(value);
      i = next;
      while (i < n && WHITESPACE.test(valuesBody[i]!)) i++;
      if (valuesBody[i] === ',') {
        i++;
        continue;
      }
      if (valuesBody[i] === ')') {
        i++;
        break;
      }
      throw new Error(`atteso ',' o ')' alla posizione ${i} di una tupla di INSERT`);
    }
    tuples.push(values);
  }
  return tuples;
}
