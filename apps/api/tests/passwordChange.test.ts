import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../src/lib/password.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL,
  BOTH_EMAIL,
  createHarness,
  signIn,
  TEST_EMAIL,
  TEST_PASSWORD,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W1, T2 (W1-4) e T6 (S3): finché `mustChangePassword` è vero ogni rotta
 * autenticata risponde 403 `PASSWORD_CHANGE_REQUIRED` — rifiuto per difetto —
 * tranne `/auth/me`, `/auth/password` e `/auth/logout`, ammesse esplicitamente.
 */

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness('api_password_change');
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

async function setMustChange(value: boolean): Promise<void> {
  await harness.db
    .update(schema.users)
    .set({ mustChangePassword: value })
    .where(eq(schema.users.email, TEST_EMAIL));
}

describe('cambio obbligatorio della password', () => {
  it('con il cambio richiesto le rotte di area rispondono 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const signed = await signIn(harness);
    await setMustChange(true);
    for (const url of ['/contents', '/settings', '/roles']) {
      const risposta = await harness.app.inject({
        method: 'GET',
        url,
        headers: { cookie: signed.cookie },
      });
      expect(risposta.statusCode, url).toBe(403);
      expect(risposta.json().error.code, url).toBe('PASSWORD_CHANGE_REQUIRED');
    }
    await setMustChange(false);
  });

  it('con il cambio richiesto /auth/context è rifiutata', async () => {
    const signed = await signIn(harness, { area: null });
    await setMustChange(true);
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/auth/context',
      headers: signed.writeHeaders,
      payload: { roleId: crypto.randomUUID(), area: 'redazione' },
    });
    expect(risposta.statusCode).toBe(403);
    expect(risposta.json().error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    await setMustChange(false);
  });

  it('S3: con il cambio richiesto anche le rotte autenticate senza area sono rifiutate', async () => {
    const signed = await signIn(harness);
    await setMustChange(true);
    const elenco = await harness.app.inject({
      method: 'GET',
      url: '/auth/sessions',
      headers: { cookie: signed.cookie },
    });
    const revoca = await harness.app.inject({
      method: 'POST',
      url: '/auth/sessions/revoke-all',
      headers: signed.writeHeaders,
    });
    await setMustChange(false);
    for (const risposta of [elenco, revoca]) {
      expect(risposta.statusCode).toBe(403);
      expect(risposta.json().error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    }
  });

  it('S3: con il cambio richiesto una scrittura con token anti-CSRF valido è rifiutata', async () => {
    const signed = await signIn(harness);
    await setMustChange(true);
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: signed.writeHeaders,
      payload: { kind: 'page', title: 'Prova sintetica' },
    });
    await setMustChange(false);
    expect(risposta.statusCode, risposta.body).toBe(403);
    expect(risposta.json().error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    const create = await harness.db.select({ id: schema.contents.id }).from(schema.contents);
    expect(create).toHaveLength(0);
  });

  it('/auth/me risponde e dice che il cambio è richiesto', async () => {
    const signed = await signIn(harness);
    await setMustChange(true);
    const risposta = await harness.app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: signed.cookie },
    });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().mustChangePassword).toBe(true);
    await setMustChange(false);
  });

  it('il login restituisce il valore reale di mustChangePassword', async () => {
    await setMustChange(true);
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().mustChangePassword).toBe(true);
    await setMustChange(false);
  });

  it('/auth/logout risponde anche con il cambio richiesto', async () => {
    const signed = await signIn(harness);
    await setMustChange(true);
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: signed.writeHeaders,
    });
    expect(risposta.statusCode).toBe(200);
    await setMustChange(false);
  });

  it('S1: rifiuta una nuova password uguale a quella attuale, in italiano, e il cambio resta richiesto', async () => {
    const signed = await signIn(harness, { email: ADMIN_EMAIL, area: null });
    await harness.db
      .update(schema.users)
      .set({ mustChangePassword: true })
      .where(eq(schema.users.email, ADMIN_EMAIL));
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/auth/password',
      headers: signed.writeHeaders,
      payload: { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD },
    });
    expect(risposta.statusCode).toBe(400);
    expect(JSON.stringify(risposta.json().error.details)).toMatch(/diversa da quella attuale/);
    const [row] = await harness.db
      .select({ mustChangePassword: schema.users.mustChangePassword })
      .from(schema.users)
      .where(eq(schema.users.email, ADMIN_EMAIL));
    expect(row?.mustChangePassword).toBe(true);
  });

  it('S3: dopo il cambio obbligatorio una seconda sessione della stessa persona è revocata', async () => {
    const altra = await signIn(harness);
    const signed = await signIn(harness);
    await setMustChange(true);
    const cambio = await harness.app.inject({
      method: 'POST',
      url: '/auth/password',
      headers: signed.writeHeaders,
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'password-sintetica-intermedia' },
    });
    expect(cambio.statusCode).toBe(200);
    expect(cambio.headers['cache-control']).toBe('no-store');
    const vecchia = await harness.app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: altra.cookie },
    });
    expect(vecchia.statusCode).toBe(401);
    // Ripristina la password di prova per i casi successivi.
    await harness.db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(TEST_PASSWORD, harness.config) })
      .where(eq(schema.users.email, TEST_EMAIL));
  });

  it('dopo /auth/password riuscita il cambio non è più richiesto e le rotte si riaprono', async () => {
    const signed = await signIn(harness);
    await setMustChange(true);
    const cambio = await harness.app.inject({
      method: 'POST',
      url: '/auth/password',
      headers: signed.writeHeaders,
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'nuova-password-sintetica-lunga' },
    });
    expect(cambio.statusCode).toBe(200);

    const rinnovato = (cambio.cookies as { name: string; value: string }[]).find(
      (entry) => entry.name === harness.config.SESSION_COOKIE_NAME,
    );
    const me = await harness.app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: `${harness.config.SESSION_COOKIE_NAME}=${rinnovato?.value ?? ''}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().mustChangePassword).toBe(false);
  });
});

/**
 * S2 (ADR-007 §3.1 controllo 8): `/auth/password` verifica un segreto, quindi i
 * tentativi falliti si limitano per account e per indirizzo come l'accesso.
 * Harness a parte, con un tetto per indirizzo basso, per non toccare i casi sopra.
 */
describe('limitazione dei tentativi su /auth/password', () => {
  let limited: Harness;

  beforeAll(async () => {
    limited = await createHarness('api_password_limit', {
      LOGIN_MAX_PER_ACCOUNT: '3',
      LOGIN_MAX_PER_IP: '4',
    });
  }, 120_000);

  afterAll(async () => {
    await limited?.teardown();
  });

  function attempt(signed: Signed, ip: string, currentPassword: string) {
    return limited.app.inject({
      method: 'POST',
      url: '/auth/password',
      headers: { ...signed.writeHeaders, 'x-forwarded-for': ip },
      payload: { currentPassword, newPassword: 'password-sintetica-nuova-lunga' },
    });
  }

  it('per account: dopo i fallimenti consentiti risponde 429 anche alla password giusta', async () => {
    const signed = await signIn(limited, { email: ADMIN_EMAIL, area: null });
    for (const ip of ['10.0.0.1', '10.0.0.2', '10.0.0.3']) {
      expect((await attempt(signed, ip, 'sbagliata-sbagliata')).statusCode).toBe(403);
    }
    const bloccato = await attempt(signed, '10.0.0.4', TEST_PASSWORD);
    expect(bloccato.statusCode).toBe(429);
    expect(bloccato.json().error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(bloccato.json().error.message).toMatch(/Troppi tentativi/);
  });

  it('per indirizzo: i fallimenti di più account dallo stesso indirizzo bloccano', async () => {
    const uno = await signIn(limited, { area: null });
    const due = await signIn(limited, { email: BOTH_EMAIL, area: null });
    for (const signed of [uno, uno, due, due]) {
      expect((await attempt(signed, '10.0.9.9', 'sbagliata-sbagliata')).statusCode).toBe(403);
    }
    const bloccato = await attempt(uno, '10.0.9.9', TEST_PASSWORD);
    expect(bloccato.statusCode).toBe(429);
  });
});
