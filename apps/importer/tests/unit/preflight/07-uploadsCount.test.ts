import { describe, expect, it } from 'vitest';
import { checkUploadsCount } from '../../../src/preflight/checks/07-uploads-count.js';
import type { UploadedFile } from '../../../src/source/files/uploads.js';

function files(count: number, year = '2026'): UploadedFile[] {
  return Array.from({ length: count }, (_, i) => ({
    relativePath: `${year}/09/file-${i}.jpg`,
    sizeBytes: 100,
  }));
}

describe('preflight — controllo 7: conteggio di uploads/', () => {
  it('passa quando il conteggio dopo le esclusioni coincide con l’atteso', () => {
    const result = checkUploadsCount(files(1475), 1475);
    expect(result.ok).toBe(true);
  });

  it('fallisce su una sorgente sintetica con file mancanti', () => {
    const result = checkUploadsCount(files(1000), 1475);
    expect(result.ok).toBe(false);
    expect(result.detail?.actualCount).toBe(1000);
  });

  it('conta anche i file fuori dalle cartelle anno (DR-060: download-manager-files non è più esclusa)', () => {
    const mixed = [
      ...files(5),
      { relativePath: 'download-manager-files/modulo.pdf', sizeBytes: 10 },
    ];
    const result = checkUploadsCount(mixed, 6);
    expect(result.ok).toBe(true);
  });
});
