import { describe, expect, it } from 'vitest';
import { checkNoOpenRuns } from '../../../src/preflight/checks/08-no-open-runs.js';

describe('preflight — controllo 8: nessuna esecuzione aperta', () => {
  it('passa quando non ci sono esecuzioni aperte', () => {
    const result = checkNoOpenRuns([]);
    expect(result.ok).toBe(true);
  });

  it('fallisce quando un’esecuzione precedente è rimasta aperta', () => {
    const result = checkNoOpenRuns([{ id: 'run-interrotta-1' }]);
    expect(result.ok).toBe(false);
    expect(result.detail?.openRunIds).toEqual(['run-interrotta-1']);
  });
});
