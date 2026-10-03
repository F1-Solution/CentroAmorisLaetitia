import { describe, expect, it } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import { createObjectStore } from '../../../src/storage/objectStore.js';

describe('ObjectStore.listKeys', () => {
  it('segue le pagine finché S3 dice che non ce ne sono altre', async () => {
    // S3 restituisce al più 1.000 chiavi per pagina e l'import ne carica circa
    // 1.465: senza paginazione la verifica conterebbe come mancanti file presenti.
    const pages = [
      {
        Contents: [{ Key: 'a.jpg' }, { Key: 'b.jpg' }],
        IsTruncated: true,
        NextContinuationToken: 't1',
      },
      { Contents: [{ Key: 'c.jpg' }], IsTruncated: false },
    ];
    const tokens: (string | undefined)[] = [];
    const buckets: (string | undefined)[] = [];
    const s3 = {
      send: async (command: { input: { Bucket?: string; ContinuationToken?: string } }) => {
        tokens.push(command.input.ContinuationToken);
        buckets.push(command.input.Bucket);
        return pages[tokens.length - 1];
      },
    } as unknown as S3Client;

    const keys = await createObjectStore(s3, { public: 'pub', private: 'priv' }).listKeys(
      'private',
    );

    expect([...keys].sort()).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(tokens).toEqual([undefined, 't1']);
    expect(buckets).toEqual(['priv', 'priv']);
  });
});
