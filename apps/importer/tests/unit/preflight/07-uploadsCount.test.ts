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
  it('passa quando il conteggio nelle cartelle anno coincide con l’atteso', () => {
    const result = checkUploadsCount(files(1470), 1470);
    expect(result.ok).toBe(true);
  });

  it('fallisce su una sorgente sintetica con file mancanti', () => {
    const result = checkUploadsCount(files(1000), 1470);
    expect(result.ok).toBe(false);
    expect(result.detail?.actualCount).toBe(1000);
  });

  it('non conta i file nelle cartelle di servizio, anche se presenti nell’elenco', () => {
    const mixed = [...files(5), { relativePath: 'wpforms/entry.json', sizeBytes: 10 }];
    const result = checkUploadsCount(mixed, 5);
    expect(result.ok).toBe(true);
  });
});
