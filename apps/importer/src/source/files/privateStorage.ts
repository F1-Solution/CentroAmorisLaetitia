/**
 * Lettore dell'albero riservato di Customer Area (DR-058):
 * `wp-content/customer-area/storage/<hash>/<nomefile>`, fuori da `uploads/` e
 * quindi invisibile al lettore di `source/files/uploads.ts`. Ogni cartella di
 * primo livello è un hash generato dal plugin, non il nome dell'`id` presente
 * nei meta di `wp_postmeta` (misurato: i due valori non coincidono) — la
 * risoluzione va fatta per nome di file, mai per quell'id.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export interface PrivateStorageFile {
  /** `<hash>/<nomefile>`, sempre in forma POSIX. */
  readonly relativePath: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

/**
 * Elenca i file `<hash>/<file>` sotto `privateStoragePath`, un solo livello,
 * che e' la disposizione misurata dell'archivio del plugin. L'archivio
 * riservato può mancare del tutto (sorgente sintetica nei test, ambienti senza
 * `source-private/`): in quel caso l'elenco è vuoto, non un errore.
 */
export async function listPrivateStorageFiles(
  privateStoragePath: string,
): Promise<readonly PrivateStorageFile[]> {
  let topLevel;
  try {
    topLevel = await readdir(privateStoragePath, { withFileTypes: true });
  } catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
  }

  const files: PrivateStorageFile[] = [];
  for (const entry of topLevel) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(privateStoragePath, entry.name);
    const children = await readdir(dirPath, { withFileTypes: true });
    for (const child of children) {
      if (!child.isFile()) continue;
      const info = await stat(path.join(dirPath, child.name));
      files.push({
        relativePath: path.posix.join(entry.name, child.name),
        fileName: child.name,
        sizeBytes: info.size,
      });
    }
  }
  return files;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
