/**
 * Lettura del file del dump: decodifica UTF-8, impronta SHA-256 e dimensione
 * per il controllo 1 del preflight, e verifica indipendente dei conteggi per
 * tabella (`IMPORTER-DESIGN.md` §3.7 prova 5).
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseDump } from './tokenizer.js';
import type { Dump, DumpIssue } from './types.js';

export interface DumpFingerprint {
  readonly sha256: string;
  readonly sizeBytes: number;
}

export async function fingerprintDumpFile(path: string): Promise<DumpFingerprint> {
  const buffer = await readFile(path);
  return { sha256: createHash('sha256').update(buffer).digest('hex'), sizeBytes: buffer.length };
}

/**
 * Decodifica come UTF-8. Una sequenza non valida diventa il carattere di
 * sostituzione (`�`) e produce una riga `import_issues` di gravità
 * `warning` — mai il valore che l'ha causata (`IMPORTER-DESIGN.md` §3.6).
 */
export function decodeUtf8WithReplacementTracking(buffer: Buffer): {
  text: string;
  hadReplacements: boolean;
} {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(buffer);
  return { text, hadReplacements: text.includes('�') };
}

export async function readDump(path: string): Promise<Dump> {
  const buffer = await readFile(path);
  const { text, hadReplacements } = decodeUtf8WithReplacementTracking(buffer);
  const dump = parseDump(text);
  if (!hadReplacements) return dump;

  const issues: DumpIssue[] = [
    ...dump.issues,
    { severity: 'warning', table: '(sconosciuta)', code: 'invalid-utf8-byte' },
  ];
  return { ...dump, issues };
}

/**
 * Verifica indipendente: conta grossolanamente le tuple di ogni `INSERT` con
 * un'espressione regolare che non condivide codice con il tokenizzatore. Serve
 * a far emergere un tokenizzatore che perde righe in silenzio
 * (`IMPORTER-DESIGN.md` §3.7 prova 5): se il conteggio indipendente e quello
 * del tokenizzatore divergono per una tabella, qualcosa non torna.
 */
export function countTuplesRoughly(sql: string): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const insertRe = /INSERT INTO\s+`([^`]+)`[^;]*?VALUES\s*([\s\S]*?);/gi;
  let match: RegExpExecArray | null;
  while ((match = insertRe.exec(sql)) !== null) {
    const table = match[1]!;
    const valuesBody = match[2]!;
    // conta le '(' che aprono una tupla al primo livello, cercando la sequenza
    // "),(" e le parentesi di apertura/chiusura a inizio/fine blocco. E'
    // grossolano di proposito: non deve condividere logica con il tokenizzatore.
    const openParens = (valuesBody.match(/\(/g) ?? []).length;
    const closeParens = (valuesBody.match(/\)/g) ?? []).length;
    void closeParens;
    // stima: ogni tupla di primo livello apre esattamente una parentesi in piu'
    // rispetto alle parentesi annidate nei valori — non affidabile da sola,
    // quindi si conta invece per separatore "),(" + 1.
    const separators = (valuesBody.match(/\),\s*\(/g) ?? []).length;
    counts.set(table, (counts.get(table) ?? 0) + separators + 1);
    void openParens;
  }
  return counts;
}
