/**
 * Lettura dell'albero di `uploads/` — `IMPORTER-DESIGN.md` §3.9. Enumera i
 * file, esclude le cartelle di servizio, calcola il checksum SHA-256 in
 * streaming.
 *
 * Le esclusioni sono le cinque cartelle di servizio restanti di ADR-004 §3.2
 * (`backwpup*` per prefisso, `wpforms`, `aioseo`, `wpdm-cache`, `et_temp`) più
 * le due rilevate in `IMPORTER-DESIGN.md` §11.1: `wpdm-custom-tags` e
 * `wpdm-file-type-icons` non sono media del sito, sono risorse di un plugin.
 *
 * **DR-060**: `download-manager-files` è **uscita** dall'elenco. ADR-004 §3.2
 * la classificava come cartella di servizio, ma contiene i quattro moduli per
 * le consulenze in PDF che il sito offre in scaricamento (fase 9
 * `documents`): è contenuto, non cache. Lo scostamento dall'elenco dell'ADR è
 * dichiarato lì e ripreso qui nel codice.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const EXCLUDED_TOP_LEVEL_FOLDERS: readonly string[] = [
  'wpforms',
  'aioseo',
  'wpdm-cache',
  'et_temp',
  // Rilievi di IMPORTER-DESIGN.md §11.1, non presenti nell'elenco di ADR-004 §3.2:
  'wpdm-custom-tags',
  'wpdm-file-type-icons',
];

/** Le cartelle `backwpup*` si escludono per prefisso, non per nome esatto. */
export function isExcludedTopLevelFolder(name: string): boolean {
  if (name.startsWith('backwpup')) return true;
  return EXCLUDED_TOP_LEVEL_FOLDERS.includes(name);
}

export interface UploadedFile {
  readonly relativePath: string;
  readonly sizeBytes: number;
}

/** Elenca ricorsivamente i file sotto `uploadsPath`, saltando le cartelle di primo livello escluse. */
export async function listUploadedFiles(uploadsPath: string): Promise<UploadedFile[]> {
  const files: UploadedFile[] = [];
  const topLevel = await readdir(uploadsPath, { withFileTypes: true });

  for (const entry of topLevel) {
    if (entry.isDirectory() && isExcludedTopLevelFolder(entry.name)) continue;
    const entryPath = path.join(uploadsPath, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath, entry.name, files);
    } else if (entry.isFile()) {
      const info = await stat(entryPath);
      files.push({ relativePath: entry.name, sizeBytes: info.size });
    }
  }
  return files;
}

async function walk(dir: string, relativeDir: string, out: UploadedFile[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    const relativePath = path.posix.join(relativeDir.split(path.sep).join('/'), entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath, relativePath, out);
    } else if (entry.isFile()) {
      const info = await stat(entryPath);
      out.push({ relativePath, sizeBytes: info.size });
    }
  }
}

/** Calcola il checksum SHA-256 di un file, in streaming: non lo carica intero in memoria. */
export function checksumFile(absolutePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absolutePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/** Solo le cartelle il cui nome è un anno a quattro cifre (`IMPORTER-DESIGN.md` §11.1). */
export function isYearFolder(name: string): boolean {
  return /^\d{4}$/.test(name);
}
