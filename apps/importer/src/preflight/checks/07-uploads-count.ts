import type { CheckResult } from '../types.js';
import { isYearFolder } from '../../source/files/uploads.js';
import type { UploadedFile } from '../../source/files/uploads.js';

/**
 * Controllo 7: la cartella `uploads` è leggibile e contiene il numero atteso
 * di file. Il numero atteso conta solo le cartelle anno
 * (`IMPORTER-DESIGN.md` §11.1): è quello che diventa il bucket pubblico.
 */
export function checkUploadsCount(files: readonly UploadedFile[], expectedCount: number): CheckResult {
  const inYearFolders = files.filter((f) => isYearFolder(f.relativePath.split('/')[0] ?? ''));
  const ok = inYearFolders.length === expectedCount;
  return {
    check: 'uploads-count',
    ok,
    message: ok
      ? `${expectedCount} file nelle cartelle anno, come atteso`
      : `${inYearFolders.length} file trovati nelle cartelle anno, attesi ${expectedCount}: sorgente incompleta`,
    detail: { actualCount: inYearFolders.length, expectedCount, totalFiles: files.length },
  };
}
