/**
 * `SourceReader` — la sola interfaccia con cui il resto del programma vede la
 * sorgente (`IMPORTER-DESIGN.md` §2). Nessun altro modulo tocca
 * `source-private/` direttamente.
 */
import path from 'node:path';
import { fingerprintDumpFile, readDump } from './sql/file.js';
import type { Dump, SqlRow } from './sql/types.js';
import { listUploadedFiles, type UploadedFile } from './files/uploads.js';
import { listPrivateStorageFiles, type PrivateStorageFile } from './files/privateStorage.js';

export interface SourceReader {
  readonly dumpPath: string;
  readonly uploadsPath: string;
  /** Albero riservato di Customer Area (DR-058), fuori da `uploadsPath`. */
  readonly privateStoragePath: string;
  /** Impronta del file del dump: controllo 1 del preflight. */
  fingerprint(): Promise<{ sha256: string; sizeBytes: number }>;
  /** Analizza il dump per intero. Costoso: si chiama una sola volta per esecuzione. */
  dump(): Promise<Dump>;
  tableNames(): Promise<readonly string[]>;
  rows(table: string): Promise<readonly SqlRow[]>;
  uploadedFiles(): Promise<readonly UploadedFile[]>;
  privateFiles(): Promise<readonly PrivateStorageFile[]>;
}

export interface SourceReaderOptions {
  readonly dumpPath: string;
  readonly uploadsPath: string;
  /**
   * Opzionale per compatibilità con i chiamanti scritti prima di DR-058: se
   * assente, si deriva dalla disposizione reale della sorgente — `wp-content/uploads`
   * e `wp-content/customer-area/storage` sono cartelle sorelle.
   */
  readonly privateStoragePath?: string;
}

function defaultPrivateStoragePath(uploadsPath: string): string {
  return path.join(path.dirname(uploadsPath), 'customer-area', 'storage');
}

export function createSourceReader(options: SourceReaderOptions): SourceReader {
  let cachedDump: Promise<Dump> | null = null;
  const privateStoragePath =
    options.privateStoragePath ?? defaultPrivateStoragePath(options.uploadsPath);

  const dump = (): Promise<Dump> => {
    cachedDump ??= readDump(options.dumpPath);
    return cachedDump;
  };

  return {
    dumpPath: options.dumpPath,
    uploadsPath: options.uploadsPath,
    privateStoragePath,
    fingerprint: () => fingerprintDumpFile(options.dumpPath),
    dump,
    tableNames: async () => Array.from((await dump()).tables.keys()),
    rows: async (table: string) => (await dump()).rows.get(table) ?? [],
    uploadedFiles: () => listUploadedFiles(options.uploadsPath),
    privateFiles: () => listPrivateStorageFiles(privateStoragePath),
  };
}
