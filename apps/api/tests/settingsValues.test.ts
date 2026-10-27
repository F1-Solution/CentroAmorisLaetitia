import { schema } from '@amoris/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL,
  createHarness,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Valori delle impostazioni dell'organizzazione (DR-185): il CMS le modifica, il
 * servizio rifiuta un tipo sbagliato prima che arrivi al sito pubblico. Dati sintetici.
 */

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_valori_impostazioni');
  signed = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
  await harness.db.insert(schema.settings).values([
    { key: 'contact.address', value: sql`'null'::jsonb`, label: 'Indirizzo' },
    { key: 'contact.phone', value: '', label: 'Telefono' },
    { key: 'social.profiles', value: [], label: 'Profili social' },
    { key: 'content.posts_per_page', value: 10, label: 'Articoli per pagina' },
    { key: 'site.locale', value: 'it_IT', label: 'Lingua del sito' },
    { key: 'site.timezone', value: 'Europe/Rome', label: 'Fuso orario' },
    { key: 'site.date_format', value: 'j F Y', label: 'Formato data' },
    { key: 'site.time_format', value: 'G:i', label: 'Formato ora' },
    { key: 'site.start_of_week', value: 1, label: 'Primo giorno della settimana' },
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

/*
 * DR-270: il sito pubblico legge lingua, fuso, formati e articoli per pagina. Un
 * valore che il sito non saprebbe usare si rifiuta qui, con un messaggio in
 * italiano che dice che cosa serve; il sito resta comunque difensivo.
 */
describe('impostazioni lette dal sito (DR-270)', () => {
  it('accetta i valori di WordPress: lingua, fuso, formati PHP, giorno, articoli per pagina', async () => {
    expect((await put('content.posts_per_page', 1)).statusCode).toBe(200);
    expect((await put('content.posts_per_page', 50)).statusCode).toBe(200);
    expect((await put('site.locale', 'en_US')).statusCode).toBe(200);
    expect((await put('site.locale', 'de_DE_formal')).statusCode).toBe(200);
    expect((await put('site.timezone', 'UTC')).statusCode).toBe(200);
    expect((await put('site.date_format', 'd/m/Y')).statusCode).toBe(200);
    expect((await put('site.time_format', 'H:i')).statusCode).toBe(200);
    expect((await put('site.start_of_week', 0)).statusCode).toBe(200);
    // I valori di oggi, rimessi: la prova resta ripetibile.
    for (const [key, value] of [
      ['content.posts_per_page', 10],
      ['site.locale', 'it_IT'],
      ['site.timezone', 'Europe/Rome'],
      ['site.date_format', 'j F Y'],
      ['site.time_format', 'G:i'],
      ['site.start_of_week', 1],
    ] as const) {
      expect((await put(key, value)).statusCode).toBe(200);
    }
  });

  it('prova negativa: articoli per pagina fuori da 1–50 o non interi, con il motivo in italiano', async () => {
    for (const assurdo of [0, -3, 51, 1_000_000, 2.5, '0', 'dieci', '2.5', '', null]) {
      const response = await put('content.posts_per_page', assurdo);
      expect(response.statusCode, String(assurdo)).toBe(400);
      expect(response.json().error.message).toBe(
        '«Articoli per pagina» deve essere un numero intero da 1 a 50.',
      );
    }
  });

  it('prova negativa: fuso, lingua, giorno e formati che il sito non saprebbe usare', async () => {
    const rifiuti: [string, unknown, string][] = [
      [
        'site.timezone',
        'Marte/Olimpo',
        '«Fuso orario» deve essere un fuso come Europe/Rome o UTC.',
      ],
      ['site.timezone', '', '«Fuso orario» deve essere un fuso come Europe/Rome o UTC.'],
      ['site.timezone', '+01:00', '«Fuso orario» deve essere un fuso come Europe/Rome o UTC.'],
      ['site.timezone', 'europe/rome', '«Fuso orario» deve essere un fuso come Europe/Rome o UTC.'],
      ['site.timezone', 'UTC+1', '«Fuso orario» deve essere un fuso come Europe/Rome o UTC.'],
      ['site.locale', 'italiano', '«Lingua del sito» deve essere un codice come it_IT o en_US.'],
      ['site.locale', 42, '«Lingua del sito» deve essere un codice come it_IT o en_US.'],
      [
        'site.start_of_week',
        7,
        '«Primo giorno della settimana» deve essere un numero da 0 (domenica) a 6 (sabato).',
      ],
      [
        'site.date_format',
        'x'.repeat(101),
        '«Formato data» deve essere un testo di al massimo 100 caratteri.',
      ],
      ['site.time_format', 5, '«Formato ora» deve essere un testo di al massimo 100 caratteri.'],
    ];
    for (const [key, value, message] of rifiuti) {
      const response = await put(key, value);
      expect(response.statusCode, `${key} = ${String(value)}`).toBe(400);
      expect(response.json().error.message).toBe(message);
    }
  });
});

/*
 * Un'impostazione numerica rimasta `null` arriva alla schermata come campo di
 * testo, e la schermata rimanda il testo scritto: «10» come stringa. Il servizio
 * accetta un intero scritto come testo e lo salva come numero, così il valore
 * torna numerico e la volta dopo la schermata mostra un campo numerico.
 */
describe('impostazioni numeriche rimaste nulle (DR-270, giro 1)', () => {
  it('un intero scritto come testo si salva come numero', async () => {
    await harness.db
      .update(schema.settings)
      .set({ value: sql`'null'::jsonb` })
      .where(eq(schema.settings.key, 'content.posts_per_page'));
    const response = await put('content.posts_per_page', '10');
    expect(response.statusCode).toBe(200);
    expect(response.json().value).toBe(10);
    const giorno = await put('site.start_of_week', ' 0 ');
    expect(giorno.statusCode).toBe(200);
    expect(giorno.json().value).toBe(0);
    expect((await put('site.start_of_week', 1)).json().value).toBe(1);
  });

  it('i fusi IANA scritti bene, anche come alias, si accettano', async () => {
    for (const timezone of ['Etc/UTC', 'Europe/Kyiv', 'UTC', 'Europe/Rome']) {
      expect((await put('site.timezone', timezone)).statusCode, timezone).toBe(200);
    }
  });
});
