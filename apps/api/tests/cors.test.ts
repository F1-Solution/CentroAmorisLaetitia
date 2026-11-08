import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/**
 * Il preflight, che è l'unico posto in cui il CORS si vede senza un browser.
 *
 * Difetto del 2026-09-23: la libreria, senza `methods`, ne ammette **tre** —
 * `GET`, `HEAD`, `POST` — e il browser rifiutava ogni scrittura che non fosse
 * una creazione **prima di inviarla**. Dall'area amministrativa fallivano tutti
 * i salvataggi: impostazioni, SEO, media, menu, redirect. Nessuna prova se n'era
 * accorta, perché tutte chiamano l'applicazione in processo, dove il CORS non
 * entra in gioco.
 *
 * Qui non serve un database: un preflight non arriva mai al gestore della rotta.
 */

const ORIGINE = 'http://localhost:3001';

const config = loadConfig({
  DATABASE_URL: 'postgres://nessuno:nessuno@127.0.0.1:59999/inesistente',
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  IP_HASH_SALT: 'sale-sintetico-per-i-test-abbastanza-lungo',
  CSRF_SECRET: 'segreto-sintetico-per-i-test-abbastanza-lungo',
  TOTP_ENCRYPTION_KEY: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
  CORS_ORIGINS: `http://localhost:3000,${ORIGINE}`,
});

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp(config);
  await app.ready();
});

afterAll(async () => {
  await app?.close();
});

function preflight(method: string) {
  return app.inject({
    method: 'OPTIONS',
    url: '/settings/site.title',
    headers: {
      origin: ORIGINE,
      'access-control-request-method': method,
      'access-control-request-headers': 'content-type,x-csrf-token',
    },
  });
}

describe('il preflight ammette i metodi che il servizio usa davvero', () => {
  // Non solo lettura e creazione: modificare ed eliminare sono la metà del CMS.
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    it(`${method} è ammesso`, async () => {
      const response = await preflight(method);
      expect(response.statusCode).toBeLessThan(300);
      expect(response.headers['access-control-allow-methods']).toContain(method);
    });
  }

  it('l’intestazione anti-CSRF passa: senza, ogni scrittura sarebbe respinta', async () => {
    const response = await preflight('PATCH');
    expect(String(response.headers['access-control-allow-headers'])).toContain('x-csrf-token');
  });

  it('i cookie sono ammessi: la sessione vive lì', async () => {
    const response = await preflight('PATCH');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('un’origine non dichiarata non viene autorizzata', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/settings/site.title',
      headers: {
        origin: 'http://esempio.invalid',
        'access-control-request-method': 'PATCH',
      },
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
