import { sql } from 'drizzle-orm';
import { Writable } from 'node:stream';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createHarness, fakeObjectStore, type Harness } from './_support/harness.js';

/**
 * Wave 1G-W7, T2i giro 2: il log dell'API riduce ogni errore di query a nome,
 * codice SQL e nome del vincolo. `DrizzleQueryError` porta nel messaggio la query
 * e i parametri; l'errore di postgres-js porta `query`, `parameters`, `detail` e
 * `where`; il messaggio di Postgres stesso può citare un valore («invalid input
 * syntax for type integer: "…"»). Nessuno di questi deve arrivare al log, da
 * qualunque rotta e da qualunque punto che scriva `err`. Indirizzi sintetici.
 */

const PERSONALE = 'persona.segreta@example.invalid';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness('api_error_log_query');
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

async function tracedApp(lines: string[]) {
  const logStream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString('utf8'));
      done();
    },
  });
  return buildApp(
    { ...harness.config, LOG_LEVEL: 'info' },
    { objectStore: fakeObjectStore(), logStream },
  );
}

describe('errori di query nel log comune', () => {
  it('Drizzle, postgres-js e un errore con query e params: solo nome, codice e vincolo', async () => {
    const lines: string[] = [];
    const app = await tracedApp(lines);
    const raw = postgres(harness.config.DATABASE_URL, { max: 1, onnotice: () => {} });
    await app.register(async (scoped) => {
      // Errore vero di Drizzle: il messaggio porta query, parametri e il valore citato da Postgres.
      scoped.get('/__giro2/drizzle', async () => {
        await scoped.db.execute(sql`select ${PERSONALE}::int`);
        return { ok: true };
      });
      // Errore vero di postgres-js, senza Drizzle.
      scoped.get('/__giro2/postgres', async () => {
        await raw`select ${PERSONALE}::int`;
        return { ok: true };
      });
      // Violazione d'unicità: `detail` porta «Key (email)=(…) already exists».
      scoped.get('/__giro2/unique', async () => {
        await raw`create temporary table t_giro2 (email text constraint t_giro2_email_unique unique)`;
        await raw`insert into t_giro2 values (${PERSONALE})`;
        await raw`insert into t_giro2 values (${PERSONALE})`;
        return { ok: true };
      });
      // Errore qualunque che dichiara query e parametri.
      scoped.get('/__giro2/simile', async () => {
        throw Object.assign(new Error(`guasto con ${PERSONALE}`), {
          query: 'select $1',
          params: [PERSONALE],
          code: '42000',
        });
      });
    });
    await app.ready();
    try {
      for (const url of [
        '/__giro2/drizzle',
        '/__giro2/postgres',
        '/__giro2/unique',
        '/__giro2/simile',
      ]) {
        const risposta = await app.inject({ method: 'GET', url });
        expect(risposta.statusCode, url).toBe(500);
        expect(risposta.body, url).not.toContain(PERSONALE);
      }
      // Anche chi scrive `err` fuori dal gestore degli errori passa dalla stessa riduzione.
      try {
        await app.db.execute(sql`select ${PERSONALE}::int`);
      } catch (caught) {
        app.log.error({ err: caught }, 'scrittura diretta');
      }

      const log = lines.join('');
      // Il log ha davvero registrato i quattro guasti e la scrittura diretta.
      expect(log.match(/richiesta fallita/g)?.length).toBe(4);
      expect(log).toContain('scrittura diretta');
      expect(log).not.toContain(PERSONALE);
      expect(log).not.toContain('persona.segreta');
      expect(log).not.toMatch(/Failed query|select \$1|invalid input syntax|already exists/i);
      expect(log).not.toMatch(/"(params|parameters|query|detail|where)"/);
      // Resta ciò che serve a capire il guasto.
      expect(log).toContain('"code":"22P02"');
      expect(log).toContain('"code":"23505"');
      expect(log).toContain('"constraint":"t_giro2_email_unique"');
      expect(log).toContain('"type":"DrizzleQueryError"');
      expect(log).toContain('"code":"42000"');
    } finally {
      await app.close();
      await raw.end();
    }
  });

  it('un errore ordinario porta messaggio, traccia e causa in un campo `cause` separato', async () => {
    const lines: string[] = [];
    const app = await tracedApp(lines);
    await app.register(async (scoped) => {
      scoped.get('/__giro2/ordinario', async () => {
        throw new Error('guasto ordinario di prova', { cause: new Error('causa di prova') });
      });
    });
    await app.ready();
    try {
      const risposta = await app.inject({ method: 'GET', url: '/__giro2/ordinario' });
      expect(risposta.statusCode).toBe(500);
      const log = lines.join('');
      expect(log).toContain('guasto ordinario di prova');
      expect(log).toContain('causa di prova');
      expect(log).toContain('"stack":"Error: guasto ordinario di prova');
    } finally {
      await app.close();
    }
  });

  it('giro 3: cause, AggregateError, campi propri e oggetti non-Error sono ridotti con la stessa regola', async () => {
    const lines: string[] = [];
    const app = await tracedApp(lines);
    await app.ready();
    try {
      let drizzle: unknown;
      try {
        await app.db.execute(sql`select ${PERSONALE}::int`);
      } catch (caught) {
        drizzle = caught;
      }
      expect(drizzle).toBeInstanceOf(Error);

      // Errore di query nella causa di un errore ordinario.
      app.log.error({ err: new Error('involucro di prova', { cause: drizzle }) }, 'caso causa');
      // AggregateError: `errors` non è enumerabile, ma gli interni non devono sparire.
      app.log.error(
        { err: new AggregateError([drizzle, new Error('interno visibile')], 'aggregato di prova') },
        'caso aggregato',
      );
      // Errore di query in un campo proprio diverso da `cause`.
      app.log.error(
        { err: Object.assign(new Error('campo proprio di prova'), { original: drizzle }) },
        'caso campo',
      );
      // Oggetto non-Error con query e parametri, sotto `err` e come causa.
      const simile = {
        query: 'insert into t values ($1)',
        params: [PERSONALE],
        detail: `Key (email)=(${PERSONALE}) already exists.`,
        where: `valore ${PERSONALE}`,
        code: '23505',
        constraint_name: 'simile_email_unique',
      };
      app.log.error({ err: simile }, 'caso oggetto');
      app.log.error(
        { err: new Error('causa oggetto di prova', { cause: simile }) },
        'caso oggetto causa',
      );
      // Un ciclo non deve bloccare né far fallire la scrittura.
      const ciclico = new Error('ciclo di prova') as Error & { self?: unknown };
      ciclico.self = ciclico;
      app.log.error({ err: ciclico }, 'caso ciclo');

      const log = lines.join('');
      for (const marker of [
        'caso causa',
        'caso aggregato',
        'caso campo',
        'caso oggetto',
        'caso ciclo',
      ]) {
        expect(log, marker).toContain(marker);
      }
      expect(log).not.toContain(PERSONALE);
      expect(log).not.toMatch(/Failed query|invalid input syntax|insert into/i);
      expect(log).not.toMatch(/"(params|parameters|query|detail|where)"/);
      expect(log).toContain('involucro di prova');
      expect(log).toContain('aggregato di prova');
      expect(log).toContain('interno visibile');
      expect(log).toContain('campo proprio di prova');
      expect(log).toContain('causa oggetto di prova');
      expect(log).toContain('"constraint":"simile_email_unique"');
      // Ogni caso con l'errore di Drizzle conserva il codice: causa, aggregato, campo.
      expect(log.match(/"code":"22P02"/g)?.length).toBeGreaterThanOrEqual(3);
    } finally {
      await app.close();
    }
  });

  it('giro 4: la validazione resta leggibile, query e detail con codice SQL restano ridotti', async () => {
    const lines: string[] = [];
    const app = await tracedApp(lines);
    await app.ready();
    try {
      // Dettagli di validazione: `params` qui non è un parametro di query.
      const validazione = Object.assign(new Error('richiesta non valida di prova'), {
        validation: [
          {
            instancePath: '/fullName',
            keyword: 'minLength',
            params: { limit: 1 },
            message: 'troppo corto',
          },
        ],
      });
      app.log.error({ err: validazione }, 'caso validazione');
      app.log.error({ err: { query: 'select $1', params: [PERSONALE] } }, 'caso query');
      app.log.error(
        { err: { detail: `Key (email)=(${PERSONALE}) already exists.`, code: '23505' } },
        'caso detail',
      );
      // Un array lungo si tronca a 50 elementi e dice quanti ne ha omessi.
      app.log.error(
        {
          err: Object.assign(new Error('elenco lungo di prova'), {
            items: Array.from({ length: 60 }, (_, index) => `voce-${index}`),
          }),
        },
        'caso elenco',
      );

      const riga = (marker: string) => lines.find((line) => line.includes(marker)) ?? '';
      const leggibile = riga('caso validazione');
      expect(leggibile).toContain('"instancePath":"/fullName"');
      expect(leggibile).toContain('"keyword":"minLength"');
      expect(leggibile).toContain('"params":{"limit":1}');
      expect(leggibile).toContain('"message":"troppo corto"');

      const query = riga('caso query');
      expect(query).not.toContain(PERSONALE);
      expect(query).not.toMatch(/"(query|params)"/);

      const detail = riga('caso detail');
      expect(detail).not.toContain(PERSONALE);
      expect(detail).not.toContain('"detail"');
      expect(detail).toContain('"code":"23505"');

      const elenco = riga('caso elenco');
      expect(elenco).toContain('voce-49');
      expect(elenco).not.toContain('voce-50');
      expect(elenco).toContain('[altri 10 elementi omessi]');
    } finally {
      await app.close();
    }
  });
});
