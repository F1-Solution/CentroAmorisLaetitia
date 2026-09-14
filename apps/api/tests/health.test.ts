import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/**
 * Il servizio viene costruito e interrogato in memoria, senza aprire una porta.
 *
 * L'indirizzo del database punta di proposito a una porta dove non risponde
 * nessuno: serve a dimostrare la distinzione fra i due endpoint di stato — il
 * processo è vivo anche quando il database non c'è, ma non è pronto a lavorare.
 */

const config = loadConfig({
  DATABASE_URL: 'postgres://nessuno:nessuno@127.0.0.1:59999/inesistente',
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
});

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp(config);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('stato del servizio', () => {
  it('«vivo» risponde 200 anche con il database irraggiungibile', async () => {
    const risposta = await app.inject({ method: 'GET', url: '/health/live' });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json()).toMatchObject({ status: 'ok' });
  });

  it('«pronto» risponde 503 quando il database non risponde', async () => {
    const risposta = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(risposta.statusCode).toBe(503);
    const corpo = risposta.json();
    expect(corpo.status).toBe('degraded');
    expect(corpo.dependencies).toContainEqual(
      expect.objectContaining({ name: 'database', ok: false }),
    );
  });

  it('il messaggio di errore non rivela indirizzo né credenziali del database', async () => {
    const corpo = await app.inject({ method: 'GET', url: '/health/ready' });
    const testo = corpo.body;
    expect(testo).not.toContain('nessuno');
    expect(testo).not.toContain('59999');
    expect(testo).not.toContain('postgres://');
  });
});

describe('errori', () => {
  it('una rotta inesistente risponde con l’involucro previsto', async () => {
    const risposta = await app.inject({ method: 'GET', url: '/non-esiste' });
    expect(risposta.statusCode).toBe(404);
    expect(risposta.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});

describe('specifica OpenAPI', () => {
  it('è generata dagli schemi e descrive i due endpoint di stato', async () => {
    const risposta = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(risposta.statusCode).toBe(200);
    const spec = risposta.json();
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(['/health/live', '/health/ready']),
    );
  });
});
