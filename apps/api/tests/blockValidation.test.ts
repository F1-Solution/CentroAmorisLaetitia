import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Il servizio valida il documento a blocchi al **confine** (DR-079).
 *
 * Difetto del 2026-09-23: non lo faceva. La forma dichiarata si fermava a «un
 * numero e un elenco di cose» e nessuno guardava dentro le cose, mentre il
 * commento sopra affermava il contrario. Un documento con proprietà inesistenti
 * è entrato a database — dal comando di popolamento sintetico, ma sarebbe
 * potuto entrare da un import o da un client — e l'editor poi si rifiutava di
 * aprirlo. L'unico posto che validava era l'editor, cioè dopo.
 *
 * Il documento sbagliato di questa prova è **esattamente quello** che il seme
 * scriveva: due nomi di proprietà inesistenti e un valore fuori formato.
 */

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_validazione_blocchi');
  signed = await signIn(harness, { area: 'redazione' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

function creaConBlocchi(slug: string, blocks: unknown) {
  return harness.app.inject({
    method: 'POST',
    url: '/contents',
    headers: signed.writeHeaders,
    payload: { type: 'page', slug, title: `Prova ${slug}`, blocks },
  });
}

const blocchiValidi = {
  schema: 1,
  blocks: [
    {
      type: 'image',
      id: 'b_a11a00000001',
      props: { mediaId: null, src: '/media/2026/01/inventata.png', alt: 'Immagine inventata.' },
      children: [],
    },
  ],
};

describe('il documento a blocchi si valida in ingresso', () => {
  it('un documento valido entra', async () => {
    const response = await creaConBlocchi('documento-valido', blocchiValidi);
    expect(response.statusCode).toBe(201);
  });

  it('proprietà inesistenti vengono respinte, e il messaggio dice quale', async () => {
    const response = await creaConBlocchi('proprieta-inesistenti', {
      schema: 1,
      blocks: [
        {
          type: 'image',
          id: 'b_a11a00000002',
          props: {
            mediaId: null,
            src: '/media/2026/01/inventata.png',
            alt: 'Immagine inventata.',
            linkHref: null,
            linkTarget: null,
          },
          children: [],
        },
      ],
    });

    expect(response.statusCode).toBe(400);
    const corpo = JSON.stringify(response.json());
    expect(corpo).toMatch(/linkHref|linkTarget/);
  });

  it('un valore fuori formato viene respinto', async () => {
    const response = await creaConBlocchi('valore-fuori-formato', {
      schema: 1,
      blocks: [
        {
          type: 'image',
          id: 'b_a11a00000003',
          props: {
            mediaId: null,
            src: '/media/2026/01/inventata.png',
            alt: 'Immagine inventata.',
            // Deve corrispondere a una misura, per esempio `1024x768`.
            variant: 'full',
          },
          children: [],
        },
      ],
    });
    expect(response.statusCode).toBe(400);
  });

  it('un tipo di blocco che non esiste viene respinto', async () => {
    const response = await creaConBlocchi('tipo-inesistente', {
      schema: 1,
      blocks: [{ type: 'carosello_immaginario', id: 'b_a11a00000004', props: {}, children: [] }],
    });
    expect(response.statusCode).toBe(400);
  });

  it('vale anche sulla copia di lavoro, non solo sulla creazione', async () => {
    const creata = await creaConBlocchi('copia-di-lavoro-validata', blocchiValidi);
    expect(creata.statusCode).toBe(201);
    const { id, updatedAt } = creata.json() as { id: string; updatedAt: string };

    const response = await harness.app.inject({
      method: 'PUT',
      url: `/contents/${id}/draft`,
      headers: signed.writeHeaders,
      payload: {
        title: 'Con blocchi rotti',
        blocks: { schema: 1, blocks: [{ type: 'image' }] },
        baseUpdatedAt: updatedAt,
      },
    });
    expect(response.statusCode).toBe(400);
  });
});
