import { describe, expect, it } from 'vitest';
import { checkDumpFingerprint } from '../../../src/preflight/checks/01-dump-fingerprint.js';

const expected = { sha256: 'abc123', sizeBytes: 100 };

describe('preflight — controllo 1: impronta del dump', () => {
  it('passa quando impronta e dimensione coincidono', () => {
    const result = checkDumpFingerprint({ sha256: 'abc123', sizeBytes: 100 }, expected);
    expect(result.ok).toBe(true);
  });

  it('fallisce su una sorgente sintetica alterata: impronta diversa', () => {
    const result = checkDumpFingerprint({ sha256: 'diversa', sizeBytes: 100 }, expected);
    expect(result.ok).toBe(false);
    expect(result.check).toBe('dump-fingerprint');
  });

  it('fallisce anche se solo la dimensione cambia', () => {
    const result = checkDumpFingerprint({ sha256: 'abc123', sizeBytes: 999 }, expected);
    expect(result.ok).toBe(false);
  });
});
