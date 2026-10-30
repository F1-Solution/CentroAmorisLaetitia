import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { findById } from '../src/modules/content/service.js';
import type * as ContentService from '../src/modules/content/service.js';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Wave 1G-W9, T8, rilievo M5: senza copia di lavoro, `GET /contents/:id/draft`
 * deve solo sapere se il contenuto esiste, e per questo basta l'identificativo.
 *
 * Il caso «senza copia» è il più comune (ogni apertura dell'editor di un
 * contenuto mai toccato), e leggere il contenuto per intero — blocchi e HTML
 * importato compresi — per buttarlo via subito è lavoro sprecato. La lettura
 * completa del modulo dei contenuti è avvolta in una spia: la rotta non deve
 * chiamarla, né per il contenuto che esiste (204) né per quello che non esiste
 * (404). Dati sintetici.
 */

vi.mock('../src/modules/content/service.js', async (importOriginal) => {
  const original = await importOriginal<typeof ContentService>();
  return { ...original, findById: vi.fn(original.findById) };
});

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_draft_absence_light');
  signed = await signIn(harness, { area: 'redazione' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

describe('GET /contents/:id/draft senza copia di lavoro', () => {
  it('risponde 204 senza leggere il contenuto per intero', async () => {
    const creato = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: signed.writeHeaders,
      payload: { type: 'page', slug: 'pagina-senza-copia', title: 'Pagina senza copia' },
    });
    expect(creato.statusCode, creato.body).toBe(201);
    const id = creato.json().id as string;

    vi.mocked(findById).mockClear();
    const risposta = await harness.app.inject({
      method: 'GET',
      url: `/contents/${id}/draft`,
      headers: { cookie: signed.cookie },
    });
    expect(risposta.statusCode).toBe(204);
    expect(findById).not.toHaveBeenCalled();
  });

  it('risponde 404 per un contenuto che non esiste, sempre senza lettura completa', async () => {
    vi.mocked(findById).mockClear();
    const risposta = await harness.app.inject({
      method: 'GET',
      url: `/contents/${MISSING_ID}/draft`,
      headers: { cookie: signed.cookie },
    });
    expect(risposta.statusCode).toBe(404);
    expect(findById).not.toHaveBeenCalled();
  });
});
