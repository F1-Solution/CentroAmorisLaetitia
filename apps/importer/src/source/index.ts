/**
 * `SourceReader` — la sola interfaccia con cui il resto del programma vede la
 * sorgente (`IMPORTER-DESIGN.md` §2). Nessun altro modulo tocca
 * `source-private/` direttamente.
 */
import { fingerprintDumpFile, readDump } from './sql/file.js';
import type { Dump, SqlRow } from './sql/types.js';
import { listUploadedFiles, type UploadedFile } from './files/uploads.js';

export interface SourceReader {
  readonly dumpPath: string;
  readonly uploadsPath: string;
  /** Impronta del file del dump: controllo 1 del preflight. */
  fingerprint(): Promise<{ sha256: string; sizeBytes: number }>;
  /** Analizza il dump per intero. Costoso: si chiama una sola volta per esecuzione. */
  dump(): Promise<Dump>;
  tableNames(): Promise<readonly string[]>;
  rows(table: string): Promise<readonly SqlRow[]>;
  uploadedFiles(): Promise<readonly UploadedFile[]>;
}

export interface SourceReaderOptions {
  readonly dumpPath: string;
  readonly uploadsPath: string;
}

export function createSourceReader(options: SourceReaderOptions): SourceReader {
  let cachedDump: Promise<Dump> | null = null;

  const dump = (): Promise<Dump> => {
    cachedDump ??= readDump(options.dumpPath);
    return cachedDump;
  };

  return {
    dumpPath: options.dumpPath,
    uploadsPath: options.uploadsPath,
    fingerprint: () => fingerprintDumpFile(options.dumpPath),
    dump,
    tableNames: async () => Array.from((await dump()).tables.keys()),
    rows: async (table: string) => (await dump()).rows.get(table) ?? [],
    uploadedFiles: () => listUploadedFiles(options.uploadsPath),
  };
}
