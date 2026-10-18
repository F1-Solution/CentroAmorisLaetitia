import { schema } from '@amoris/db';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Valori delle impostazioni dell'organizzazione (DR-185): il CMS le modifica, il
 * servizio rifiuta un tipo sbagliato prima che arrivi al sito pubblico. Dati sintetici.
 */

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_valori_impostazioni');
  signed = await signIn(harness, { area: 'impostazioni' });
  await harness.db.insert(schema.settings).values([
    { key: 'contact.address', value: sql`'null'::jsonb`, label: 'Indirizzo' },
    { key: 'contact.phone', value: '', label: 'Telefono' },
    { key: 'social.profiles', value: [], label: 'Profili social' },
  ]);
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const put = (key: string, value: unknown) =>
  harness.app.inject({
    method: 'PUT',
    url: `/settings/${key}`,
    headers: signed.writeHeaders,
    payload: { value },
  });

describe('impostazioni dell’organizzazione (DR-185)', () => {
  it('accetta testo per indirizzo e telefono, un elenco di indirizzi per i profili', async () => {
    expect((await put('contact.address', 'Via Sintetica 1, Città')).statusCode).toBe(200);
    expect((await put('contact.phone', '+39 000 0000000')).statusCode).toBe(200);
    const response = await put('social.profiles', ['https://social.example.invalid/centro']);
    expect(response.statusCode).toBe(200);
    expect(response.json().value).toEqual(['https://social.example.invalid/centro']);
    expect((await put('contact.address', null)).statusCode).toBe(200);
  });

  it('prova negativa: rifiuta tipi sbagliati', async () => {
    expect((await put('contact.phone', 123)).statusCode).toBe(400);
    expect((await put('social.profiles', 'https://social.example.invalid/centro')).statusCode).toBe(
      400,
    );
    expect((await put('social.profiles', ['non un indirizzo'])).statusCode).toBe(400);
    expect((await put('contact.address', { via: 'x' })).statusCode).toBe(400);
  });

  it('prova negativa: rifiuta profili con schemi diversi da http e https', async () => {
    expect((await put('social.profiles', ['javascript:alert(1)'])).statusCode).toBe(400);
    expect((await put('social.profiles', ['data:text/html,x'])).statusCode).toBe(400);
  });

  it('una chiave come `constructor` non trova uno schema ereditato: 404, non 500', async () => {
    expect((await put('constructor', 'x')).statusCode).toBe(404);
  });
});
