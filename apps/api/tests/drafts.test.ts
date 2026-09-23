import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Copie di lavoro, **DR-068**.
 *
 * Il punto che questi test difendono non è che il salvataggio funzioni: è che
 * il salvataggio automatico **non tocchi il contenuto pubblicato**. È la
 * ragione per cui il criterio 1D-36 e il requisito F-05 — aprire un contenuto e
 * salvarlo senza modifiche non cambia né i blocchi né l'HTML reso — restano
 * veri con una copia di lavoro in mezzo: si verificano sul contenuto, non sulla
 * bozza, e qui si prova che i due sono davvero separati.
 */

let harness: Harness;
let signed: Signed;
let contentId: string;
let updatedAt: string;

beforeAll(async () => {
  harness = await createHarness('api_copie_di_lavoro');
  signed = await signIn(harness, { area: 'redazione' });

  const creata = await harness.app.inject({
    method: 'POST',
    url: '/contents',
    headers: signed.writeHeaders,
    payload: { type: 'page', slug: 'con-copia-di-lavoro', title: 'Con copia di lavoro' },
  });
  const corpo = creata.json();
  contentId = corpo.id;
  updatedAt = corpo.updatedAt;
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

async function storedContent() {
  const [row] = await harness.db
    .select({
      title: schema.contents.title,
      blocks: schema.contents.blocks,
      contentHtml: schema.contents.contentHtml,
      updatedAt: schema.contents.updatedAt,
    })
    .from(schema.contents)
    .where(eq(schema.contents.id, contentId))
    .limit(1);
  return row;
}

describe('la copia di lavoro non tocca il contenuto', () => {
  it('salvarla non cambia titolo, blocchi né HTML del contenuto', async () => {
    const prima = await storedContent();

    const salvata = await harness.app.inject({
      method: 'PUT',
      url: `/contents/${contentId}/draft`,
      headers: signed.writeHeaders,
      payload: {
        title: 'Titolo soltanto nella copia',
        // Un blocco **completo**: dal 2026-09-23 il servizio valida il documento
        // con gli schemi di `packages/blocks`, e un blocco a cui mancano le
        // quattro chiavi di `BLOCK-MODEL.md` §1 viene respinto — che è il punto.
        blocks: {
          schema: 1,
          blocks: [
            {
              type: 'rich_text',
              id: 'b_d7af00000001',
              props: { html: '<p>Solo nella copia di lavoro.</p>' },
              children: [],
            },
          ],
        },
        baseUpdatedAt: updatedAt,
      },
    });
    expect(salvata.statusCode).toBe(200);
    expect(salvata.json().title).toBe('Titolo soltanto nella copia');

    const dopo = await storedContent();
    expect(dopo?.title).toBe(prima?.title);
    expect(dopo?.blocks).toEqual(prima?.blocks);
    expect(dopo?.contentHtml).toBe(prima?.contentHtml);
    expect(dopo?.updatedAt.toISOString()).toBe(prima?.updatedAt.toISOString());
  });

  it('salvarla due volte non ne crea due: è una per persona e per contenuto', async () => {
    for (const titolo of ['Primo salvataggio', 'Secondo salvataggio']) {
      await harness.app.inject({
        method: 'PUT',
        url: `/contents/${contentId}/draft`,
        headers: signed.writeHeaders,
        payload: { title: titolo, blocks: { schema: 1, blocks: [] }, baseUpdatedAt: updatedAt },
      });
    }

    const righe = await harness.db
      .select({ id: schema.contentDrafts.id, title: schema.contentDrafts.title })
      .from(schema.contentDrafts)
      .where(eq(schema.contentDrafts.contentId, contentId));

    expect(righe).toHaveLength(1);
    expect(righe[0]?.title).toBe('Secondo salvataggio');
  });

  it('si rilegge, e dichiara se il contenuto è cambiato sotto', async () => {
    const letta = await harness.app.inject({
      method: 'GET',
      url: `/contents/${contentId}/draft`,
      headers: { cookie: signed.cookie },
    });
    expect(letta.statusCode).toBe(200);
    expect(letta.json().stillCurrent).toBe(true);

    // Il contenuto cambia per un'altra strada: la copia resta, ma sa di essere
    // partita da una versione che non c'è più.
    await harness.app.inject({
      method: 'PATCH',
      url: `/contents/${contentId}`,
      headers: signed.writeHeaders,
      payload: { title: 'Cambiato per comando esplicito' },
    });

    const dopo = await harness.app.inject({
      method: 'GET',
      url: `/contents/${contentId}/draft`,
      headers: { cookie: signed.cookie },
    });
    expect(dopo.json().stillCurrent).toBe(false);
  });

  it('si scarta, e sparisce', async () => {
    const scartata = await harness.app.inject({
      method: 'DELETE',
      url: `/contents/${contentId}/draft`,
      headers: signed.writeHeaders,
    });
    expect(scartata.statusCode).toBe(204);

    const letta = await harness.app.inject({
      method: 'GET',
      url: `/contents/${contentId}/draft`,
      headers: { cookie: signed.cookie },
    });
    expect(letta.statusCode).toBe(404);
  });
});
