import { schema } from '@amoris/db';
import { and, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import { tokenDigest } from '../src/lib/crypto.js';
import {
  createHarness,
  signIn,
  TEST_EMAIL,
  TEST_PASSWORD,
  type Harness,
} from './_support/harness.js';

/**
 * I **12 controlli obbligatori** di ADR-007 §3.1, uno per `describe`.
 *
 * Il §6 dell'ADR li chiama «una lista di verifica, non una descrizione»: questo
 * file è la lista, e il criterio di uscita 17 pretende che ogni voce abbia un
 * test che passa. Il controllo 11 è l'unico senza attuazione, ed è dichiarato
 * fuori perimetro: il suo test verifica che davvero **non** esista un canale di
 * recupero, perché «fuori perimetro» e «dimenticato» si assomigliano troppo.
 *
 * Dalla wave 1G-W9 (criterio 1G-24) `GET /auth/me` dice «nessuna sessione
 * valida» con `204` senza corpo, non più con `401`: dove qui si verifica che
 * una sessione non vale più, il segnale atteso è quindi `204`.
 */

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness('api_adr007');
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

/**
 * Verifica che una sessione non valga più per due strade: `/auth/me` non
 * restituisce nessuna persona (`204` senza corpo) e una lettura protetta viene
 * davvero **rifiutata** (`401`). La seconda attesa tiene il nome del
 * controllo 4, «applicate lato server», anche ora che `/auth/me` non rifiuta
 * più: una regressione che lasciasse la sessione valida solo per le rotte
 * protette verrebbe vista qui (M3 della revisione T8, 1G-W9).
 */
async function expectSessionRejected(target: Harness, cookie: string): Promise<void> {
  const me = await target.app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
  expect(me.statusCode).toBe(204);
  expect(me.body).toBe('');

  const protetta = await target.app.inject({
    method: 'GET',
    url: '/contents',
    headers: { cookie },
  });
  expect(protetta.statusCode, protetta.body).toBe(401);
}

describe('controllo 1 — password con Argon2id e parametri dichiarati in configurazione', () => {
  it('l’hash a database è Argon2id con i parametri della configurazione', async () => {
    const [row] = await harness.db
      .select({ passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.email, TEST_EMAIL));

    const { ARGON2_MEMORY_KIB, ARGON2_TIME_COST, ARGON2_PARALLELISM } = harness.config;
    expect(row?.passwordHash).toMatch(
      new RegExp(
        `^\\$argon2id\\$v=19\\$m=${ARGON2_MEMORY_KIB},t=${ARGON2_TIME_COST},p=${ARGON2_PARALLELISM}\\$`,
      ),
    );
  });

  it('la password in chiaro non compare da nessuna parte nell’hash', async () => {
    const [row] = await harness.db
      .select({ passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.email, TEST_EMAIL));
    expect(row?.passwordHash).not.toContain(TEST_PASSWORD);
  });
});

describe('controllo 2 — token di sessione da 256 bit, a database solo il digest', () => {
  it('il token ha 256 bit di casualità e non si ripete', async () => {
    const primo = await signIn(harness);
    const secondo = await signIn(harness);
    const estrai = (cookie: string) => cookie.split('; ')[0]?.split('=').slice(1).join('=') ?? '';

    const a = estrai(primo.cookie);
    const b = estrai(secondo.cookie);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(a).not.toBe(b);
  });

  it('a database c’è il digest del token, mai il token', async () => {
    const signed = await signIn(harness);
    const token = signed.cookie.split('; ')[0]?.split('=').slice(1).join('=') ?? '';

    const righe = await harness.db
      .select({ digest: schema.sessions.tokenDigest })
      .from(schema.sessions);

    const digest = tokenDigest(token);
    expect(righe.some((riga) => riga.digest.equals(digest))).toBe(true);
    // Il token in chiaro non compare in nessuna delle colonne conservate.
    expect(righe.some((riga) => riga.digest.toString('utf8') === token)).toBe(false);
  });
});

describe('controllo 3 — cookie HttpOnly, Secure, SameSite=Lax, Path=/, senza dominio', () => {
  it('il cookie di sessione porta tutti e quattro gli attributi', async () => {
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    const cookie = (risposta.cookies as Record<string, unknown>[]).find(
      (entry) => entry.name === harness.config.SESSION_COOKIE_NAME,
    );
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
    });
    expect(cookie).not.toHaveProperty('domain');
  });

  it('il cookie anti-CSRF è leggibile dal client, perché è la metà del doppio invio', async () => {
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    const cookie = (risposta.cookies as Record<string, unknown>[]).find(
      (entry) => entry.name === harness.config.CSRF_COOKIE_NAME,
    );
    expect(cookie).toMatchObject({ secure: true, sameSite: 'Lax', path: '/' });
    // Assente, non «falso»: il client deve poterlo leggere.
    expect(cookie).not.toHaveProperty('httpOnly');
  });
});

describe('controllo 4 — scadenze di inattività e assoluta, applicate lato server', () => {
  it('la sessione inattiva oltre il limite non vale più, benché il cookie sia intatto', async () => {
    const signed = await signIn(harness);
    const token = signed.cookie.split('; ')[0]?.split('=').slice(1).join('=') ?? '';

    const troppoVecchia = new Date(
      Date.now() - (harness.config.SESSION_IDLE_HOURS + 1) * 3_600_000,
    );
    await harness.db
      .update(schema.sessions)
      .set({ lastSeenAt: troppoVecchia })
      .where(eq(schema.sessions.tokenDigest, tokenDigest(token)));

    await expectSessionRejected(harness, signed.cookie);
  });

  it('la scadenza assoluta vale anche se la sessione è stata usata un istante fa', async () => {
    const signed = await signIn(harness);
    const token = signed.cookie.split('; ')[0]?.split('=').slice(1).join('=') ?? '';

    await harness.db
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() - 1000), lastSeenAt: new Date() })
      .where(eq(schema.sessions.tokenDigest, tokenDigest(token)));

    await expectSessionRejected(harness, signed.cookie);
  });
});

describe('controllo 5 — rotazione del token a ogni accesso e a ogni cambio di password', () => {
  it('due accessi di fila producono due token diversi', async () => {
    const primo = await signIn(harness);
    const secondo = await signIn(harness);
    expect(primo.cookie).not.toBe(secondo.cookie);
  });

  it('il cambio di password rilascia un token nuovo e invalida il precedente', async () => {
    const proprio = await createHarness('api_rotazione');
    try {
      const signed = await signIn(proprio);
      const nuova = 'altra-password-sintetica-lunga';

      const risposta = await proprio.app.inject({
        method: 'POST',
        url: '/auth/password',
        headers: signed.writeHeaders,
        payload: { currentPassword: TEST_PASSWORD, newPassword: nuova },
      });
      expect(risposta.statusCode).toBe(200);

      const rinnovato = (risposta.cookies as { name: string; value: string }[]).find(
        (entry) => entry.name === proprio.config.SESSION_COOKIE_NAME,
      );
      expect(rinnovato?.value).toBeTruthy();
      expect(signed.cookie).not.toContain(rinnovato?.value ?? '');

      await expectSessionRejected(proprio, signed.cookie);
    } finally {
      await proprio.teardown();
    }
  }, 120_000);
});

describe('controllo 6 — revoca immediata, di una sessione e di tutte', () => {
  it('la disconnessione invalida la sessione all’istante', async () => {
    const signed = await signIn(harness);
    const uscita = await harness.app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: signed.writeHeaders,
    });
    expect(uscita.statusCode).toBe(200);

    await expectSessionRejected(harness, signed.cookie);
  });

  it('la revoca di tutte le sessioni lascia viva solo quella che l’ha chiesta', async () => {
    const altra = await signIn(harness);
    const corrente = await signIn(harness);

    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/auth/sessions/revoke-all',
      headers: corrente.writeHeaders,
    });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().revoked).toBeGreaterThanOrEqual(1);

    await expectSessionRejected(harness, altra.cookie);

    const conLaCorrente = await harness.app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: corrente.cookie },
    });
    expect(conLaCorrente.statusCode).toBe(200);
  });
});

describe('controllo 7 — token anti-CSRF a doppio invio su ogni richiesta che modifica dati', () => {
  it('senza token la scrittura è respinta, anche con una sessione valida', async () => {
    const signed = await signIn(harness);
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: { cookie: signed.cookie },
      payload: { type: 'page', slug: 'senza-token', title: 'Senza token' },
    });
    expect(risposta.statusCode).toBe(403);
    expect(risposta.json().error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('un token di un’altra sessione non vale', async () => {
    const prima = await signIn(harness);
    const seconda = await signIn(harness);

    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: { cookie: prima.cookie, 'x-csrf-token': seconda.csrf },
      payload: { type: 'page', slug: 'token-altrui', title: 'Token altrui' },
    });
    expect(risposta.statusCode).toBe(403);
  });

  it('con il token della propria sessione la scrittura passa', async () => {
    const signed = await signIn(harness);
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: signed.writeHeaders,
      payload: { type: 'page', slug: 'con-token', title: 'Con token' },
    });
    expect(risposta.statusCode).toBe(201);
  });

  it('la lettura non richiede alcun token', async () => {
    const signed = await signIn(harness);
    const risposta = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: signed.cookie },
    });
    expect(risposta.statusCode).toBe(200);
  });
});

describe('controllo 8 — limitazione dei tentativi per account e per indirizzo', () => {
  it('oltre il tetto per account l’accesso è respinto con 429, anche con la password giusta', async () => {
    const proprio = await createHarness('api_tentativi_account', { LOGIN_MAX_PER_ACCOUNT: '3' });
    try {
      for (let tentativo = 0; tentativo < 3; tentativo += 1) {
        const fallito = await proprio.app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: TEST_EMAIL, password: 'password-sbagliata' },
        });
        expect(fallito.statusCode).toBe(401);
      }

      const bloccato = await proprio.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });
      expect(bloccato.statusCode).toBe(429);
      expect(bloccato.json().error.code).toBe('TOO_MANY_ATTEMPTS');
    } finally {
      await proprio.teardown();
    }
  }, 120_000);

  it('il tetto per indirizzo scatta anche cambiando ogni volta l’indirizzo tentato', async () => {
    const proprio = await createHarness('api_tentativi_ip', {
      LOGIN_MAX_PER_ACCOUNT: '50',
      LOGIN_MAX_PER_IP: '3',
    });
    try {
      for (let tentativo = 0; tentativo < 3; tentativo += 1) {
        await proprio.app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: `ignoto-${tentativo}@esempio.invalid`, password: 'qualunque' },
        });
      }

      const bloccato = await proprio.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });
      expect(bloccato.statusCode).toBe(429);
    } finally {
      await proprio.teardown();
    }
  }, 120_000);

  it('il ritardo cresce con i tentativi falliti', async () => {
    const proprio = await createHarness('api_ritardo', {
      LOGIN_MAX_PER_ACCOUNT: '50',
      LOGIN_DELAY_STEP_MS: '120',
      LOGIN_DELAY_MAX_MS: '2000',
    });
    try {
      const primo = Date.now();
      await proprio.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: 'sbagliata' },
      });
      const durataPrimo = Date.now() - primo;

      for (let tentativo = 0; tentativo < 4; tentativo += 1) {
        await proprio.app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: TEST_EMAIL, password: 'sbagliata' },
        });
      }

      const ultimo = Date.now();
      await proprio.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: 'sbagliata' },
      });
      const durataUltimo = Date.now() - ultimo;

      expect(durataUltimo).toBeGreaterThan(durataPrimo);
    } finally {
      await proprio.teardown();
    }
  }, 120_000);
});

describe('controllo 9 — nessuna enumerazione degli account', () => {
  it('indirizzo inesistente e password errata danno la stessa risposta, parola per parola', async () => {
    const inesistente = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nessuno@esempio.invalid', password: 'qualunque' },
    });
    const sbagliata = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: 'password-sbagliata' },
    });

    expect(inesistente.statusCode).toBe(sbagliata.statusCode);
    expect(inesistente.json().error.code).toBe(sbagliata.json().error.code);
    expect(inesistente.json().error.message).toBe(sbagliata.json().error.message);
  });

  it('il registro non scrive l’indirizzo tentato in chiaro, ma il suo digest', async () => {
    const proprio = await createHarness('api_enumerazione');
    try {
      const tentato = 'sconosciuto@esempio.invalid';
      await proprio.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: tentato, password: 'qualunque' },
      });

      const righe = await proprio.db
        .select({ entityId: schema.auditLog.entityId, detail: schema.auditLog.detail })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, 'auth.login'));

      const digest = createHash('sha256').update(tentato, 'utf8').digest('hex');
      expect(righe.some((riga) => riga.entityId === digest)).toBe(true);
      expect(righe.some((riga) => riga.entityId === tentato)).toBe(false);
      expect(JSON.stringify(righe)).not.toContain(tentato);
    } finally {
      await proprio.teardown();
    }
  }, 120_000);

  it('il tempo di risposta non distingue i due casi', async () => {
    const proprio = await createHarness('api_tempi', { LOGIN_UNIFORM_MS: '250' });
    try {
      const misura = async (email: string) => {
        const inizio = Date.now();
        await proprio.app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email, password: 'password-sbagliata' },
        });
        return Date.now() - inizio;
      };

      const inesistente = await misura('nessuno@esempio.invalid');
      const esistente = await misura(TEST_EMAIL);

      // Entrambi pagano il tempo minimo dichiarato, quindi la differenza non
      // dice nulla su quali indirizzi siano registrati.
      expect(inesistente).toBeGreaterThanOrEqual(240);
      expect(esistente).toBeGreaterThanOrEqual(240);
    } finally {
      await proprio.teardown();
    }
  }, 120_000);
});

describe('controllo 10 — audit di accesso, fallimento, disconnessione, cambio password e revoca', () => {
  it('tutti e cinque gli eventi lasciano una riga a registro', async () => {
    const proprio = await createHarness('api_audit_auth');
    try {
      await proprio.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: TEST_EMAIL, password: 'sbagliata' },
      });
      const signed = await signIn(proprio);
      await proprio.app.inject({
        method: 'POST',
        url: '/auth/sessions/revoke-all',
        headers: signed.writeHeaders,
      });
      await proprio.app.inject({
        method: 'POST',
        url: '/auth/password',
        headers: signed.writeHeaders,
        payload: { currentPassword: TEST_PASSWORD, newPassword: 'altra-password-sintetica' },
      });
      const dopoCambio = await signIn(proprio, {
        email: TEST_EMAIL,
        password: 'altra-password-sintetica',
      });
      await proprio.app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: dopoCambio.writeHeaders,
      });

      const righe = await proprio.db
        .select({ action: schema.auditLog.action, outcome: schema.auditLog.outcome })
        .from(schema.auditLog);

      const azioni = new Set(righe.map((riga) => riga.action));
      expect(azioni.has('auth.login')).toBe(true);
      expect(azioni.has('auth.logout')).toBe(true);
      expect(azioni.has('auth.password_changed')).toBe(true);
      expect(azioni.has('auth.sessions_revoked')).toBe(true);

      const fallimenti = await proprio.db
        .select({ id: schema.auditLog.id })
        .from(schema.auditLog)
        .where(
          and(eq(schema.auditLog.action, 'auth.login'), eq(schema.auditLog.outcome, 'failure')),
        );
      expect(fallimenti.length).toBeGreaterThanOrEqual(1);
    } finally {
      await proprio.teardown();
    }
  }, 120_000);
});

describe('controllo 11 — recupero password, dichiarato fuori perimetro in Fase 1', () => {
  it('non esiste alcun canale di recupero, e non è una dimenticanza', async () => {
    const specifica = (await harness.app.inject({ method: 'GET', url: '/openapi.json' })).json();
    const percorsi = Object.keys(specifica.paths as Record<string, unknown>);

    // La reimpostazione fatta dall'amministrazione (1G-W1, DR-228) non è un canale di
    // recupero: sta in Impostazioni e senza sessione è respinta.
    const sospetti = percorsi.filter(
      (percorso) =>
        /recover|reset|forgot|dimenticata|recupero/i.test(percorso) &&
        percorso !== '/accounts/{id}/password-reset',
    );
    expect(sospetti).toEqual([]);
    const anonima = await harness.app.inject({
      method: 'POST',
      url: `/accounts/${crypto.randomUUID()}/password-reset`,
    });
    expect([401, 403]).toContain(anonima.statusCode);

    // E le richieste plausibili non rispondono comunque.
    for (const percorso of ['/auth/password-reset', '/auth/forgot-password', '/auth/recover']) {
      const risposta = await harness.app.inject({ method: 'POST', url: percorso });
      expect(risposta.statusCode).toBe(404);
    }
  });
});

describe('controllo 12 — segreti solo da variabili d’ambiente, verificate all’avvio', () => {
  it('senza il sale degli indirizzi la configurazione non si carica', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: 'postgres://x/y', CSRF_SECRET: 'x'.repeat(32) }),
    ).toThrow(ConfigError);
  });

  it('senza il segreto anti-CSRF la configurazione non si carica', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: 'postgres://x/y', IP_HASH_SALT: 'x'.repeat(32) }),
    ).toThrow(ConfigError);
  });

  it('un segreto troppo corto è rifiutato, non accettato in silenzio', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgres://x/y',
        IP_HASH_SALT: 'corto',
        CSRF_SECRET: 'x'.repeat(32),
      }),
    ).toThrow(ConfigError);
  });

  it('l’errore dice quale variabile manca, senza stamparne il valore', () => {
    try {
      loadConfig({ DATABASE_URL: 'postgres://x/y' });
      expect.unreachable('la configurazione non doveva caricarsi');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ConfigError);
      const problemi = (caught as ConfigError).problems.join('\n');
      expect(problemi).toContain('IP_HASH_SALT');
      expect(problemi).toContain('CSRF_SECRET');
    }
  });
});
