/** `SourceReader` finto per i test di fase: righe sintetiche, nessun file vero. */
import type { SourceReader } from '../../../src/source/index.js';
import type { SqlRow } from '../../../src/source/sql/types.js';

export function fakeSourceReader(tables: Readonly<Record<string, readonly SqlRow[]>>): SourceReader {
  return {
    dumpPath: '/finto/dump.sql',
    uploadsPath: '/finto/uploads',
    fingerprint: async () => ({ sha256: 'finto', sizeBytes: 0 }),
    dump: async () => ({
      tables: new Map(Object.keys(tables).map((t) => [t, Object.keys(tables[t]?.[0] ?? {})])),
      rows: new Map(Object.entries(tables)),
      issues: [],
    }),
    tableNames: async () => Object.keys(tables),
    rows: async (table: string) => tables[table] ?? [],
    uploadedFiles: async () => [],
  };
}
