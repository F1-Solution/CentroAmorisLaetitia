import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Wave 1G-W9, T8 (W8-09, criterio 1G-24): l'assenza non è un errore.
 *
 * Tre letture dell'area rispondevano con un codice d'errore quando la cosa
 * cercata semplicemente non c'era — nessuna sessione sulla schermata di
 * accesso, nessuna copia di lavoro all'apertura dell'editor, nessuna
 * sovrascrittura SEO nella sua scheda — e il browser le segnava in rosso in
 * console. Ora l'assenza è `204` senza corpo, la stessa forma che l'API usa già
 * per «niente da restituire»; il `404` resta per il contenuto che non esiste.
 * Dati sintetici.
 */

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_absence_not_error');
  signed = await signIn(harness, { area: 'redazione' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

async function create(slug: string): Promise<string> {
  const risposta = await harness.app.inject({
    method: 'POST',
    url: '/contents',
    headers: signed.writeHeaders,
    payload: { type: 'page', slug, title: `Titolo ${slug}` },
  });
  expect(risposta.statusCode, risposta.body).toBe(201);
  return risposta.json().id as string;
}

const read = (url: string, cookie?: string) =>
  harness.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });

describe('GET /auth/me senza sessione', () => {
  it('senza cookie risponde 204 senza corpo', async () => {
    const risposta = await read('/auth/me');
    expect(risposta.statusCode).toBe(204);
    expect(risposta.body).toBe('');
  });

  it('con un cookie che non vale nulla risponde 204 senza corpo', async () => {
    const risposta = await read(
      '/auth/me',
      `${harness.config.SESSION_COOKIE_NAME}=token-sintetico-inesistente`,
    );
    expect(risposta.statusCode).toBe(204);
    expect(risposta.body).toBe('');
  });

  it('con la sessione risponde 200 con la persona', async () => {
    const risposta = await read('/auth/me', signed.cookie);
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().activeArea).toBe('redazione');
  });
});

describe('GET /contents/:id/draft', () => {
  it('senza copia di lavoro risponde 204 senza corpo', async () => {
    const id = await create('assenza-copia');
    const risposta = await read(`/contents/${id}/draft`, signed.cookie);
    expect(risposta.statusCode).toBe(204);
    expect(risposta.body).toBe('');
  });

  it('per un contenuto che non esiste resta 404', async () => {
    const risposta = await read(`/contents/${MISSING_ID}/draft`, signed.cookie);
    expect(risposta.statusCode).toBe(404);
  });

  it('senza sessione resta 401', async () => {
    const id = await create('assenza-copia-anonima');
    const risposta = await read(`/contents/${id}/draft`);
    expect(risposta.statusCode).toBe(401);
  });
});

describe('GET /seo/contents/:id', () => {
  it('senza sovrascrittura risponde 204 senza corpo', async () => {
    const id = await create('assenza-seo');
    const risposta = await read(`/seo/contents/${id}`, signed.cookie);
    expect(risposta.statusCode).toBe(204);
    expect(risposta.body).toBe('');
  });

  it('per un contenuto che non esiste resta 404', async () => {
    const risposta = await read(`/seo/contents/${MISSING_ID}`, signed.cookie);
    expect(risposta.statusCode).toBe(404);
  });

  it('con la sovrascrittura risponde 200', async () => {
    const id = await create('presenza-seo');
    const scrittura = await harness.app.inject({
      method: 'PUT',
      url: `/seo/contents/${id}`,
      headers: signed.writeHeaders,
      payload: { title: 'Titolo SEO sintetico' },
    });
    expect(scrittura.statusCode, scrittura.body).toBe(200);
    const risposta = await read(`/seo/contents/${id}`, signed.cookie);
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().title).toBe('Titolo SEO sintetico');
  });
});
