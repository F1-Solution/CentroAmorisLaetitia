import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Layout della pagina (DR-139, famiglia G della `1E-W6`): la barra laterale e la
 * larghezza della colonna, ex `_et_pb_page_layout`, si leggono e si cambiano dal
 * CMS. Il predefinito è quello del tema della sorgente, barra a destra.
 */

let harness: Harness;
let signed: Signed;
let contentId: string;

beforeAll(async () => {
  harness = await createHarness('api_layout_pagina');
  signed = await signIn(harness, { area: 'redazione' });
  const creata = await harness.app.inject({
    method: 'POST',
    url: '/contents',
    headers: signed.writeHeaders,
    payload: { type: 'post', slug: 'articolo-con-layout', title: 'Articolo con layout' },
  });
  contentId = creata.json().id;
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const read = () =>
  harness.app.inject({
    method: 'GET',
    url: `/contents/${contentId}`,
    headers: { cookie: signed.cookie },
  });

describe('layout della pagina dal CMS (DR-139)', () => {
  it('un contenuto nuovo ha la barra a destra, come il tema', async () => {
    expect((await read()).json().pageLayout).toBe('right_sidebar');
  });

  it('si cambia con una modifica e si rilegge', async () => {
    const modificato = await harness.app.inject({
      method: 'PATCH',
      url: `/contents/${contentId}`,
      headers: signed.writeHeaders,
      payload: { pageLayout: 'full_width' },
    });
    expect(modificato.statusCode).toBe(200);
    expect((await read()).json().pageLayout).toBe('full_width');
  });

  it('prova negativa: un valore fuori elenco è respinto', async () => {
    const respinto = await harness.app.inject({
      method: 'PATCH',
      url: `/contents/${contentId}`,
      headers: signed.writeHeaders,
      payload: { pageLayout: 'left_sidebar' },
    });
    expect(respinto.statusCode).toBe(400);
    expect((await read()).json().pageLayout).toBe('full_width');
  });
});
