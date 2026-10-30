import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addressFixtures, createAddressBench } from './_support/contentAddress.js';
import type { Harness, Signed } from './_support/harness.js';

/**
 * Wave 1G-W9, T7b (DR-314, D205=A): la pagina iniziale non si ritira, come non si
 * elimina. Le vie che portano un contenuto fuori da «pubblicato» sono il ritiro
 * (`POST /contents/:id/unpublish`) e, in teoria, un PATCH con lo stato: il PATCH
 * è `strict` e non ammette `status`, quindi resta 400 e lo stato non cambia.
 * Non esistono programmazione, azioni multiple né una pubblicazione della copia di
 * lavoro che scriva lo stato. Il confronto con l'impostazione non bada alle
 * maiuscole (I1 della T7): un valore salvato in maiuscolo prima della correzione
 * protegge lo stesso. Dati sintetici.
 */

let harness: Harness;
let signed: Signed;
let homeId: string;

const { insertContent } = addressFixtures(() => harness);

beforeAll(async () => {
  ({ harness, signed, homeId } = await createAddressBench('api_content_home_withdrawal'));
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const unpublish = (id: string) =>
  harness.app.inject({
    method: 'POST',
    url: `/contents/${id}/unpublish`,
    headers: signed.writeHeaders,
  });

async function statusOf(id: string): Promise<string | undefined> {
  const [row] = await harness.db
    .select({ status: schema.contents.status })
    .from(schema.contents)
    .where(eq(schema.contents.id, id));
  return row?.status;
}

async function setHomeSetting(value: string): Promise<void> {
  await harness.db
    .update(schema.settings)
    .set({ value })
    .where(eq(schema.settings.key, 'site.home_content_id'));
}

interface Err {
  error: { code: string; message: string };
}

describe('ritiro della pagina iniziale (DR-314)', () => {
  it('POST /unpublish sulla pagina iniziale: 409 CONTENT_IS_HOME, resta pubblicata e / risponde', async () => {
    const risposta = await unpublish(homeId);
    expect(risposta.statusCode, risposta.body).toBe(409);
    const { error } = risposta.json<Err>();
    expect(error.code).toBe('CONTENT_IS_HOME');
    expect(error.message).toBe(
      'Il contenuto è la pagina iniziale del sito: scegli prima un’altra pagina iniziale.',
    );
    expect(await statusOf(homeId)).toBe('published');
    const home = await harness.app.inject({ method: 'GET', url: '/public/content?path=/' });
    expect(home.statusCode).toBe(200);
  });

  it('identificativo salvato in maiuscolo: il ritiro è bloccato lo stesso', async () => {
    await setHomeSetting(homeId.toUpperCase());
    try {
      const risposta = await unpublish(homeId);
      expect(risposta.statusCode, risposta.body).toBe(409);
      expect(risposta.json<Err>().error.code).toBe('CONTENT_IS_HOME');
      expect(await statusOf(homeId)).toBe('published');
    } finally {
      await setHomeSetting(homeId);
    }
  });

  it('identificativo salvato in maiuscolo: anche l’eliminazione resta bloccata', async () => {
    await setHomeSetting(homeId.toUpperCase());
    try {
      const risposta = await harness.app.inject({
        method: 'DELETE',
        url: `/contents/${homeId}`,
        headers: signed.writeHeaders,
      });
      expect(risposta.statusCode, risposta.body).toBe(409);
      expect(risposta.json<Err>().error.code).toBe('CONTENT_IS_HOME');
      expect(await statusOf(homeId)).toBe('published');
    } finally {
      await setHomeSetting(homeId);
    }
  });

  it('PATCH con lo stato: 400, la pagina iniziale resta pubblicata', async () => {
    for (const status of ['draft', 'archived']) {
      const risposta = await harness.app.inject({
        method: 'PATCH',
        url: `/contents/${homeId}`,
        headers: signed.writeHeaders,
        payload: { status },
      });
      expect(risposta.statusCode, risposta.body).toBe(400);
      expect(await statusOf(homeId)).toBe('published');
    }
  });

  it('una pagina che non è la pagina iniziale si ritira come prima', async () => {
    const id = await insertContent({ slug: 'qualunque', path: '/qualunque/' });
    const risposta = await unpublish(id);
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json<{ status: string }>().status).toBe('draft');
    expect(await statusOf(id)).toBe('draft');
  });
});
