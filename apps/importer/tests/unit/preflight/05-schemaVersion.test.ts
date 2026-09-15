import { describe, expect, it } from 'vitest';
import { checkSchemaVersion } from '../../../src/preflight/checks/05-schema-version.js';

describe('preflight — controllo 5: versione dello schema', () => {
  it('passa quando tutte le migrazioni attese sono applicate', () => {
    const result = checkSchemaVersion(['0000_schema_iniziale'], ['0000_schema_iniziale']);
    expect(result.ok).toBe(true);
  });

  it('fallisce quando manca una migrazione: schema non allineato', () => {
    const result = checkSchemaVersion([], ['0000_schema_iniziale', '0001_qualcosa']);
    expect(result.ok).toBe(false);
    expect(result.detail?.missing).toEqual(['0000_schema_iniziale', '0001_qualcosa']);
  });
});
