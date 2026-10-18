import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Titolo vuoto (DR-201): la home importata non ha titolo, come nella sorgente.
 * In modifica, e nella copia di lavoro, il titolo vuoto è ammesso solo per i
 * contenuti che lo hanno già vuoto; un contenuto con titolo non può perderlo.
 * Dati sintetici.
 */

let harness: Harness;
let signed: Signed;
let senzaTitolo: string;
let conTitolo: string;

const crea = async (slug: string, title: string) =>
  (
    await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: signed.writeHeaders,
      payload: { type: 'page', slug, title },
    })
  ).json().id as string;

beforeAll(async () => {
  harness = await createHarness('api_titolo_vuoto');
  signed = await signIn(harness, { area: 'redazione' });
  senzaTitolo = await crea('pagina-senza-titolo', 'Provvisorio');
  conTitolo = await crea('pagina-con-titolo', 'Pagina con titolo');
  // Come l'import della home: il titolo vuoto arriva dalla sorgente, non dal CMS.
  await harness.db
    .update(schema.contents)
    .set({ title: '' })
    .where(eq(schema.contents.id, senzaTitolo));
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const patch = (id: string, payload: Record<string, unknown>) =>
  harness.app.inject({
    method: 'PATCH',
    url: `/contents/${id}`,
    headers: signed.writeHeaders,
    payload,
  });

const bozza = async (id: string, title: string) => {
  const letto = await harness.app.inject({
    method: 'GET',
    url: `/contents/${id}`,
    headers: { cookie: signed.cookie },
  });
  const corpo = letto.json();
  return harness.app.inject({
    method: 'PUT',
    url: `/contents/${id}/draft`,
    headers: signed.writeHeaders,
    payload: { title, excerpt: null, blocks: corpo.blocks, baseUpdatedAt: corpo.updatedAt },
  });
};

describe('titolo vuoto (DR-201)', () => {
  it('un contenuto senza titolo si salva lasciandolo vuoto', async () => {
    const risposta = await patch(senzaTitolo, { title: '', excerpt: 'Estratto' });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().title).toBe('');
  });

  it('un contenuto senza titolo può riceverne uno', async () => {
    expect((await patch(senzaTitolo, { title: 'Ora ha un titolo' })).statusCode).toBe(200);
    await harness.db
      .update(schema.contents)
      .set({ title: '' })
      .where(eq(schema.contents.id, senzaTitolo));
  });

  it('prova negativa: un contenuto con titolo non può perderlo', async () => {
    expect((await patch(conTitolo, { title: '' })).statusCode).toBe(400);
    const [riga] = await harness.db
      .select({ title: schema.contents.title })
      .from(schema.contents)
      .where(eq(schema.contents.id, conTitolo));
    expect(riga?.title).toBe('Pagina con titolo');
  });

  it('prova negativa: un titolo di soli spazi vale come vuoto', async () => {
    expect((await patch(conTitolo, { title: '  ' })).statusCode).toBe(400);
    expect((await bozza(conTitolo, ' 	')).statusCode).toBe(400);
  });

  it('la copia di lavoro di un contenuto senza titolo si salva', async () => {
    expect((await bozza(senzaTitolo, '')).statusCode).toBe(200);
  });

  it('prova negativa: la copia di lavoro di un contenuto con titolo non lo perde', async () => {
    expect((await bozza(conTitolo, '')).statusCode).toBe(400);
  });

  it('un contenuto nuovo richiede sempre un titolo', async () => {
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: signed.writeHeaders,
      payload: { type: 'page', slug: 'nuova-senza-titolo', title: '' },
    });
    expect(risposta.statusCode).toBe(400);
  });
});
