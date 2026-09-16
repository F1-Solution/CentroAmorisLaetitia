import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/**
 * Criterio di uscita 19 e ADR-001 §3 punto 4: «`GET /openapi.json` generata
 * dagli schemi, e un test che **fallisce** se la specifica cambia senza che la
 * modifica sia dichiarata».
 *
 * La dichiarazione è il file `openapi.snapshot.json` qui accanto: cambiare una
 * rotta senza aggiornarlo fa fallire questo test, e aggiornarlo mette la
 * modifica nel diff, dove si vede. Per rigenerarlo:
 *
 *     AGGIORNA_OPENAPI=1 pnpm --filter @amoris/api test
 *
 * La specifica si ottiene senza database: nasce dagli schemi Zod delle rotte,
 * non da ciò che c'è dentro le tabelle.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = path.join(here, 'openapi.snapshot.json');

const config = loadConfig({
  DATABASE_URL: 'postgres://nessuno:nessuno@127.0.0.1:59999/inesistente',
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  IP_HASH_SALT: 'sale-sintetico-per-i-test-abbastanza-lungo',
  CSRF_SECRET: 'segreto-sintetico-per-i-test-abbastanza-lungo',
});

let app: Awaited<ReturnType<typeof buildApp>>;
let specifica: Record<string, unknown>;

beforeAll(async () => {
  app = await buildApp(config);
  await app.ready();
  specifica = (await app.inject({ method: 'GET', url: '/openapi.json' })).json();

  if (process.env.AGGIORNA_OPENAPI === '1') {
    await writeFile(snapshotPath, `${JSON.stringify(specifica, null, 2)}\n`, 'utf8');
  }
});

afterAll(async () => {
  await app?.close();
});

describe('specifica OpenAPI', () => {
  it('non è scritta a mano: nasce dagli schemi delle rotte', () => {
    const paths = specifica.paths as Record<string, Record<string, { summary?: string }>>;
    // Le rotte dichiarano il corpo con Zod, e nella specifica il corpo c'è.
    const login = paths['/auth/login']?.post as Record<string, unknown> | undefined;
    expect(login).toBeDefined();
    expect(login?.requestBody).toBeDefined();
  });

  it('ogni modulo di ADR-001 §3 punto 1 ha almeno una rotta', () => {
    const paths = Object.keys(specifica.paths as Record<string, unknown>);
    for (const prefisso of [
      '/auth/',
      '/contents',
      '/terms',
      '/media',
      '/menus',
      '/seo/',
      '/redirects',
      '/settings',
    ]) {
      expect(paths.some((percorso) => percorso.startsWith(prefisso))).toBe(true);
    }
  });

  it('coincide con la specifica dichiarata: se cambia senza dichiararlo, qui si rompe', async () => {
    const dichiarata = JSON.parse(await readFile(snapshotPath, 'utf8')) as unknown;
    expect(specifica).toEqual(dichiarata);
  });
});
