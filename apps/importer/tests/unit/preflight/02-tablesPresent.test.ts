import { describe, expect, it } from 'vitest';
import { checkTablesPresent } from '../../../src/preflight/checks/02-tables-present.js';
import { EXPECTED_TABLES } from '../../../src/preflight/constants.js';

describe('preflight — controllo 2: tabelle attese presenti', () => {
  it('passa quando tutte le 53 tabelle attese esistono', () => {
    const result = checkTablesPresent(EXPECTED_TABLES, EXPECTED_TABLES);
    expect(result.ok).toBe(true);
  });

  it('fallisce su una sorgente sintetica a cui manca una tabella', () => {
    const withoutOne = EXPECTED_TABLES.filter((t) => t !== 'wp_terms');
    const result = checkTablesPresent(withoutOne, EXPECTED_TABLES);
    expect(result.ok).toBe(false);
    expect(result.detail?.missing).toContain('wp_terms');
  });

  it('fallisce se compare una tabella non attesa: la sorgente è cambiata', () => {
    const withExtra = [...EXPECTED_TABLES, 'wp_qualcosa_di_nuovo'];
    const result = checkTablesPresent(withExtra, EXPECTED_TABLES);
    expect(result.ok).toBe(false);
    expect(result.detail?.unexpected).toContain('wp_qualcosa_di_nuovo');
  });
});
