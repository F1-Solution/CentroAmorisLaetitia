import type { CheckResult } from '../types.js';
import type { UploadedFile } from '../../source/files/uploads.js';

/**
 * Controllo 7: la cartella `uploads` è leggibile e contiene il numero atteso
 * di file. `listUploadedFiles` (`source/files/uploads.ts`) applica già le
 * esclusioni delle cartelle di servizio: qui si contano tutti i file che
 * restano, senza un secondo filtro.
 *
 * **DR-060**: prima di questa decisione il conteggio si limitava alle
 * cartelle anno, perché `download-manager-files` era esclusa a monte e le
 * uniche cartelle superstiti erano quelle. Ora che non è più esclusa, un
 * secondo filtro sulle sole cartelle anno la scarterebbe di nuovo qui —
 * contare tutto ciò che il lettore restituisce è la forma corretta.
 */
export function checkUploadsCount(
  files: readonly UploadedFile[],
  expectedCount: number,
): CheckResult {
  const ok = files.length === expectedCount;
  return {
    check: 'uploads-count',
    ok,
    message: ok
      ? `${expectedCount} file dopo le esclusioni, come atteso`
      : `${files.length} file trovati dopo le esclusioni, attesi ${expectedCount}: sorgente incompleta`,
    detail: { actualCount: files.length, expectedCount },
  };
}
