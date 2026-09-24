import { describe, expect, it } from 'vitest';
import { checkMetaKeysClassified } from '../../../src/preflight/checks/03-meta-keys-classified.js';
import { CLASSIFIED_POSTMETA_IMPORTED } from '../../../src/preflight/constants.js';

describe('preflight — controllo 3: chiavi meta classificate', () => {
  it('passa quando ogni chiave distinta è classificata', () => {
    const result = checkMetaKeysClassified(CLASSIFIED_POSTMETA_IMPORTED.slice(0, 3));
    expect(result.ok).toBe(true);
  });

  it('passa per una chiave con prefisso escluso, per esempio _oembed_time_1700', () => {
    const result = checkMetaKeysClassified(['_oembed_time_1700']);
    expect(result.ok).toBe(true);
  });

  it('fallisce su una chiave meta sconosciuta comparsa in una sorgente sintetica alterata', () => {
    const result = checkMetaKeysClassified([
      ...CLASSIFIED_POSTMETA_IMPORTED.slice(0, 2),
      '_una_chiave_mai_vista',
    ]);
    expect(result.ok).toBe(false);
    expect(result.detail?.unclassifiedKeys).toEqual(['_una_chiave_mai_vista']);
  });
});
