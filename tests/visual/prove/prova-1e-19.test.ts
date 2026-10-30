import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { describe, it } from 'node:test';

/*
 * DR-261, residuo della 1G-W5: `prova-1e-19.ts` entrava con un account di prova e non
 * chiudeva la sessione, che restava valida 12 ore. Qui lo script parla con un'API finta
 * che registra le richieste; il database è irraggiungibile (porta 1), così la prova si
 * ferma dopo l'accesso, senza leggere né scrivere nulla. Deve comunque uscire.
 * Cookie, account e password sono sintetici.
 */

const radice = path.resolve(import.meta.dirname, '..', '..', '..');

interface Richiesta {
  readonly metodo: string;
  readonly url: string;
  readonly csrf: string | undefined;
}

interface Accesso {
  readonly activeArea: string | null;
  readonly rolesHeld: { roleId: string; areas: string[] }[];
}

const giaInRedazione: Accesso = { activeArea: 'redazione', rolesHeld: [] };

function apiFinta(registro: Richiesta[], accesso: Accesso = giaInRedazione) {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    registro.push({
      metodo: req.method ?? '',
      url: req.url ?? '',
      csrf: req.headers['x-csrf-token'] as string | undefined,
    });
    if (req.url === '/auth/login') {
      res.setHeader('set-cookie', [
        'amoris_sessione=sessione-sintetica; Path=/; HttpOnly',
        'amoris_csrf=csrf-sintetico; Path=/',
      ]);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(accesso));
      return;
    }
    if (req.url === '/auth/context') {
      res.statusCode = 403;
      res.end();
      return;
    }
    res.statusCode = req.url === '/auth/logout' ? 204 : 404;
    res.end();
  });
}

function eseguiScript(api: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const figlio = spawn(
      process.execPath,
      ['--import', 'tsx', path.join(radice, 'tests', 'visual', 'prova-1e-19.ts')],
      {
        cwd: radice,
        env: {
          ...process.env,
          API: api,
          SITO: 'http://127.0.0.1:1',
          QA_EMAIL: 'qa-prova@example.invalid',
          QA_PASSWORD: 'password-sintetica',
          DATABASE_URL: 'postgres://nessuno:nessuno@127.0.0.1:1/inesistente',
        },
        stdio: 'ignore',
      },
    );
    figlio.on('error', reject);
    figlio.on('exit', resolve);
  });
}

async function registroDi(
  accesso?: Accesso,
): Promise<{ codice: number | null; registro: Richiesta[] }> {
  const registro: Richiesta[] = [];
  const server = apiFinta(registro, accesso);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const codice = await eseguiScript(`http://127.0.0.1:${port}`);
    return { codice, registro };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('prova-1e-19: sessione di prova', () => {
  it('chiude la sessione anche quando la prova si ferma per un errore', async () => {
    const { codice, registro } = await registroDi();
    assert.equal(codice, 1, 'senza database la prova deve fallire');
    assert.deepEqual(
      registro.map((r) => `${r.metodo} ${r.url}`),
      ['POST /auth/login', 'POST /auth/logout'],
    );
    assert.equal(registro[1]?.csrf, 'csrf-sintetico');
  });

  // DR-261: l'accesso riesce ma la scelta dell'area «redazione» è rifiutata;
  // la sessione appena aperta va chiusa comunque.
  it('chiude la sessione se l’accesso riesce ma la scelta dell’area fallisce', async () => {
    const { codice, registro } = await registroDi({
      activeArea: null,
      rolesHeld: [{ roleId: 'ruolo-sintetico', areas: ['redazione'] }],
    });
    assert.equal(codice, 1);
    assert.deepEqual(
      registro.map((r) => `${r.metodo} ${r.url}`),
      ['POST /auth/login', 'POST /auth/context', 'POST /auth/logout'],
    );
    assert.equal(registro[2]?.csrf, 'csrf-sintetico');
  });

  it('chiude la sessione se nessun ruolo posseduto ha l’area «redazione»', async () => {
    const { codice, registro } = await registroDi({
      activeArea: null,
      rolesHeld: [{ roleId: 'ruolo-sintetico', areas: ['consultorio'] }],
    });
    assert.equal(codice, 1);
    assert.deepEqual(
      registro.map((r) => `${r.metodo} ${r.url}`),
      ['POST /auth/login', 'POST /auth/logout'],
    );
  });
});
