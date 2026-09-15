/**
 * Sorgente finta per `mediaStage.test.ts`, con **file veri** su disco (in una
 * cartella usa e getta sotto il tmp di sistema): la fase `media` calcola
 * checksum e dimensioni leggendo file per davvero, e un `uploadedFiles()`
 * finto senza file reali non lo eserciterebbe. Nessun dato reale della
 * sorgente (DR-010): nomi e contenuti sono di fantasia.
 */
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SourceReader } from '../../../src/source/index.js';
import type { SqlRow } from '../../../src/source/sql/types.js';
import { listUploadedFiles } from '../../../src/source/files/uploads.js';

export interface MediaSourceFixture {
  readonly source: SourceReader;
  readonly uploadsPath: string;
  writeUploadedFile(relativePath: string, content: string): Promise<void>;
  teardown(): Promise<void>;
}

export async function createMediaSourceFixture(
  tables: Readonly<Record<string, readonly SqlRow[]>>,
): Promise<MediaSourceFixture> {
  const uploadsPath = await mkdtemp(path.join(tmpdir(), 'amoris-importer-media-'));

  const writeUploadedFile = async (relativePath: string, content: string): Promise<void> => {
    const absolute = path.join(uploadsPath, relativePath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content, 'utf8');
  };

  const source: SourceReader = {
    dumpPath: '/finto/dump.sql',
    uploadsPath,
    privateStoragePath: '/finto/customer-area/storage',
    fingerprint: async () => ({ sha256: 'finto', sizeBytes: 0 }),
    dump: async () => ({
      tables: new Map(Object.keys(tables).map((t) => [t, Object.keys(tables[t]?.[0] ?? {})])),
      rows: new Map(Object.entries(tables)),
      issues: [],
    }),
    tableNames: async () => Object.keys(tables),
    rows: async (table: string) => tables[table] ?? [],
    uploadedFiles: () => listUploadedFiles(uploadsPath),
    privateFiles: async () => [],
  };

  return {
    source,
    uploadsPath,
    writeUploadedFile,
    teardown: () => rm(uploadsPath, { recursive: true, force: true }),
  };
}

/**
 * Metadato `_wp_attachment_metadata` serializzato in PHP, con una sola
 * dimensione derivata — sufficiente a provare `media_variants` senza
 * duplicare `attachmentMetadata.test.ts`.
 */
export function serializedAttachmentMetadata(options: {
  width: number;
  height: number;
  variantFile: string;
  variantWidth: number;
  variantHeight: number;
  variantMimeType: string;
}): string {
  const { width, height, variantFile, variantWidth, variantHeight, variantMimeType } = options;
  return (
    `a:3:{s:5:"width";i:${width};s:6:"height";i:${height};s:5:"sizes";a:1:{` +
    `s:9:"thumbnail";a:4:{s:4:"file";s:${variantFile.length}:"${variantFile}";` +
    `s:5:"width";i:${variantWidth};s:6:"height";i:${variantHeight};` +
    `s:9:"mime-type";s:${variantMimeType.length}:"${variantMimeType}";}}}`
  );
}
