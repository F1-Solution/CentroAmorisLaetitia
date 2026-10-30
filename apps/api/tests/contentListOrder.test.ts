import { schema } from '@amoris/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Wave 1G-W9, T4 (M1): contenuti con la stessa data di modifica escono sempre nello
 * stesso ordine, così la paginazione non ripete né salta nessuno. Dati sintetici.
 */

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_content_list_order');
  signed = await signIn(harness, { area: 'redazione' });
  const sameDate = new Date('2026-03-01T10:00:00Z');
  await harness.db.insert(schema.contents).values(
    Array.from({ length: 7 }, (_, index) => ({
      type: 'page' as const,
      status: 'draft' as const,
      slug: `pagina-${index}`,
      path: `/pagina-${index}/`,
      title: `Pagina ${index}`,
      contentText: 'testo',
      blocks: { schema: 1, blocks: [] },
      updatedAt: sameDate,
    })),
  );
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

describe('GET /contents con date uguali', () => {
  it('a pagine di due voci ordina per data e poi per identificativo, senza doppioni', async () => {
    const ids: string[] = [];
    for (let page = 1; page <= 4; page += 1) {
      const risposta = await harness.app.inject({
        method: 'GET',
        url: `/contents?perPage=2&page=${page}`,
        headers: signed.writeHeaders,
      });
      expect(risposta.statusCode, risposta.body).toBe(200);
      ids.push(...(risposta.json() as { items: { id: string }[] }).items.map((item) => item.id));
    }
    expect(new Set(ids).size).toBe(7);
    expect(ids).toEqual([...ids].sort());
  });
});
