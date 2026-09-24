import { describe, expect, it } from 'vitest';
import { checkStorageReachable } from '../../../src/preflight/checks/06-storage-reachable.js';

describe('preflight — controllo 6: storage a oggetti raggiungibile', () => {
  it('passa quando entrambi i bucket rispondono', async () => {
    const result = await checkStorageReachable({ probe: async () => true }, [
      'media-public',
      'media-private',
    ]);
    expect(result.ok).toBe(true);
  });

  it('fallisce su una configurazione alterata con un bucket irraggiungibile', async () => {
    const result = await checkStorageReachable(
      { probe: async (bucket) => bucket !== 'media-private' },
      ['media-public', 'media-private'],
    );
    expect(result.ok).toBe(false);
    expect(result.detail?.unreachable).toEqual(['media-private']);
  });

  it('tratta un errore di rete come bucket irraggiungibile, non come eccezione', async () => {
    const result = await checkStorageReachable(
      {
        probe: async () => {
          throw new Error('connessione rifiutata');
        },
      },
      ['media-public'],
    );
    expect(result.ok).toBe(false);
  });
});
