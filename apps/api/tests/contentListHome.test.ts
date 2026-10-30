import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAddressBench, type AddressBench } from './_support/contentAddress.js';

/**
 * W8-24: l'elenco dei contenuti dice quale è la pagina iniziale, così l'area la riconosce
 * anche quando il titolo importato è vuoto.
 */

let bench: AddressBench;

beforeAll(async () => {
  bench = await createAddressBench('api_elenco_home');
}, 120_000);

afterAll(async () => {
  await bench?.harness.teardown();
});

describe('elenco dei contenuti e pagina iniziale (W8-24)', () => {
  it('segna isHome solo sulla pagina iniziale', async () => {
    const altra = await bench.harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: bench.signed.writeHeaders,
      payload: { type: 'page', slug: 'pagina-comune', title: 'Pagina comune' },
    });
    expect(altra.statusCode).toBe(201);

    const elenco = await bench.harness.app.inject({
      method: 'GET',
      url: '/contents?type=page',
      headers: { cookie: bench.signed.cookie },
    });
    expect(elenco.statusCode).toBe(200);
    const items = elenco.json().items as { id: string; isHome?: boolean }[];
    expect(items.find((item) => item.id === bench.homeId)?.isHome).toBe(true);
    expect(items.find((item) => item.id === altra.json().id)?.isHome).toBe(false);
  });
});
