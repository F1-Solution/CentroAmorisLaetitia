import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  base32Encode,
  hotp,
  openSecret,
  resetSecondFactor,
  STEP_SECONDS,
} from '../src/auth/totp.js';
import { ConfigError, loadConfig } from '../src/config.js';
import {
  ADMIN_EMAIL,
  createHarness,
  fakeObjectStore,
  TEST_EMAIL,
  TEST_PASSWORD,
  verifySessionDirectly,
  type Harness,
} from './_support/harness.js';

/**
 * Wave 1F-W4, T6l-a (DR-384, DR-388, DR-391): secondo fattore TOTP per tutti gli account e conferma recente per
 * la gestione degli account. Il tempo è finto solo per `Date`, così il database non se ne accorge.
 */

let h: Harness;
let passwordHash: string;

beforeAll(async () => {
  h = await createHarness('api_second_factor');
  const [user] = await h.db.select().from(schema.users).where(eq(schema.users.email, TEST_EMAIL));
  passwordHash = user!.passwordHash!;
}, 120_000);

afterAll(async () => {
  await h?.teardown();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date() });
});

afterEach(async () => {
  vi.useRealTimers();
  // Ogni prova riparte da zero: nessun TOTP, nessuna sessione, nessun fallimento contato.
  await h.db
    .update(schema.users)
    .set({ totpSecretEnc: null, totpActivatedAt: null, totpLastStep: null });
  await h.db.update(schema.users).set({ passwordHash }).where(eq(schema.users.email, TEST_EMAIL));
  await h.db.delete(schema.sessions);
  await h.db.delete(schema.auditLog);
});

interface Session {
  readonly cookie: string;
  readonly headers: Record<string, string>;
  readonly body: { secondFactor: string; permissions: string[] };
}

async function login(email = TEST_EMAIL, password = TEST_PASSWORD, app = h.app): Promise<Session> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  const cookies = response.cookies as { name: string; value: string }[];
  const session = cookies.find((c) => c.name === h.config.SESSION_COOKIE_NAME)!;
  const csrf = cookies.find((c) => c.name === h.config.CSRF_COOKIE_NAME)!;
  const cookie = `${session.name}=${session.value}; ${csrf.name}=${csrf.value}`;
  return {
    cookie,
    headers: { cookie, 'x-csrf-token': csrf.value },
    body: response.json(),
  };
}

const post = (s: Session, url: string, payload?: object, app = h.app) =>
  app.inject({ method: 'POST', url, headers: s.headers, ...(payload ? { payload } : {}) });
const get = (s: Session, url: string) =>
  h.app.inject({ method: 'GET', url, headers: { cookie: s.cookie } });

/** Il codice giusto ora, letto dal segreto cifrato a database; `step` sposta di passi da 30 secondi. */
async function codeFor(email: string, step = 0): Promise<string> {
  const [user] = await h.db.select().from(schema.users).where(eq(schema.users.email, email));
  const secret = openSecret(user!.totpSecretEnc!, h.config.TOTP_ENCRYPTION_KEY, user!.id);
  return hotp(secret, Math.floor(Date.now() / 1000 / STEP_SECONDS) + step);
}

/** Attiva il TOTP dell'account con il flusso vero e restituisce la sessione ora verificata. */
async function enrol(
  email = TEST_EMAIL,
): Promise<{ session: Session; secret: string; code: string }> {
  const session = await login(email);
  const setup = await post(session, '/auth/second-factor/setup');
  expect(setup.statusCode).toBe(200);
  const code = await codeFor(email);
  const activated = await post(session, '/auth/second-factor/activate', { code });
  expect(activated.statusCode).toBe(200);
  return { session, secret: setup.json().secret, code };
}

/** JSON dei dati letti, con gli identificativi `bigint` del registro in forma di testo. */
const dump = (value: unknown): string =>
  JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? String(item) : item));

const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe('cancello del secondo fattore', () => {
  it('dopo la password nessuna rotta di dati risponde, e /auth/me dice lo stato', async () => {
    const s = await login();
    expect(s.body.secondFactor).toBe('activation_required');
    expect(s.body.permissions).toEqual([]);
    for (const url of ['/auth/sessions', '/contents', '/accounts', '/media']) {
      const response = await get(s, url);
      expect(response.statusCode, url).toBe(403);
      expect(response.json().error).toMatchObject({
        code: 'SECOND_FACTOR_REQUIRED',
        step: 'activate',
      });
    }
    const me = await get(s, '/auth/me');
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ secondFactor: 'activation_required', permissions: [] });
    expect((await post(s, '/auth/logout')).statusCode).toBe(200);
  });

  it('viene prima del cambio password obbligatorio e le rotte del secondo fattore restano aperte', async () => {
    await h.db
      .update(schema.users)
      .set({ mustChangePassword: true })
      .where(eq(schema.users.email, TEST_EMAIL));
    try {
      const s = await login();
      const refused = await get(s, '/auth/sessions');
      expect(refused.json().error.code).toBe('SECOND_FACTOR_REQUIRED');
      expect((await post(s, '/auth/second-factor/setup')).statusCode).toBe(200);
      await post(s, '/auth/second-factor/activate', { code: await codeFor(TEST_EMAIL) });
      expect((await get(s, '/auth/sessions')).json().error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    } finally {
      await h.db
        .update(schema.users)
        .set({ mustChangePassword: false })
        .where(eq(schema.users.email, TEST_EMAIL));
    }
  });

  it('attivazione: segreto cifrato a database, codice sbagliato rifiutato, giusto sblocca', async () => {
    const s = await login();
    const setup = await post(s, '/auth/second-factor/setup');
    const { secret, otpauthUri } = setup.json();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(otpauthUri).toContain(`secret=${secret}`);
    expect(otpauthUri).toContain('issuer=Amoris%20Laetitia');

    const [stored] = await h.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, TEST_EMAIL));
    expect(stored!.totpSecretEnc).not.toContain(secret);
    expect(stored!.totpActivatedAt).toBeNull();
    const plain = openSecret(stored!.totpSecretEnc!, h.config.TOTP_ENCRYPTION_KEY, stored!.id);
    expect(base32Encode(plain)).toBe(secret);
    expect(stored!.totpSecretEnc).not.toContain(plain.toString('hex'));
    expect(() => openSecret(stored!.totpSecretEnc!, 'ef'.repeat(32), stored!.id)).toThrow();

    const wrong = await post(s, '/auth/second-factor/activate', { code: '000000' });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().error.code).toBe('INVALID_SECOND_FACTOR_CODE');
    expect((await get(s, '/auth/sessions')).statusCode).toBe(403);

    const ok = await post(s, '/auth/second-factor/activate', { code: await codeFor(TEST_EMAIL) });
    expect(ok.statusCode).toBe(200);
    expect((await get(s, '/auth/sessions')).statusCode).toBe(200);
    expect((await get(s, '/auth/me')).json().secondFactor).toBe('verified');
    // Attivato: un nuovo segreto non si genera più, né da questa sessione né da un'altra.
    expect((await post(s, '/auth/second-factor/setup')).statusCode).toBe(409);
  });

  it('verifica a ogni accesso: il codice già usato non vale due volte, quello del passo dopo sì', async () => {
    const { code } = await enrol();
    const again = await login();
    expect(again.body.secondFactor).toBe('verification_required');
    expect((await get(again, '/auth/sessions')).json().error.step).toBe('verify');
    // Lo stesso passo dell'attivazione: rifiutato, e conta come fallimento.
    expect((await post(again, '/auth/second-factor/verify', { code })).statusCode).toBe(403);
    expect(
      (await post(again, '/auth/second-factor/verify', { code: await codeFor(TEST_EMAIL, 1) }))
        .statusCode,
    ).toBe(200);
    expect((await get(again, '/auth/sessions')).statusCode).toBe(200);
  });

  it('i codici sbagliati contano come fallimenti e portano al blocco, come la password', async () => {
    await enrol();
    const s = await login();
    const attempts = h.config.LOGIN_MAX_PER_ACCOUNT;
    for (let i = 0; i < attempts; i += 1) {
      const response = await post(s, '/auth/second-factor/verify', { code: '000000' });
      expect(response.statusCode).toBe(403);
    }
    const blocked = await post(s, '/auth/second-factor/verify', {
      code: await codeFor(TEST_EMAIL, 1),
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('TOO_MANY_ATTEMPTS');
    const rows = await h.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'auth.second_factor'));
    expect(rows).toHaveLength(attempts);
    expect(rows.every((r) => r.outcome === 'failure' && r.entityType === 'auth.identifier')).toBe(
      true,
    );
  });

  it('il cambio password mantiene la sessione verificata e confermata', async () => {
    await enrol();
    const s = await login();
    await post(s, '/auth/second-factor/verify', { code: await codeFor(TEST_EMAIL, 1) });
    const changed = await post(s, '/auth/password', {
      currentPassword: TEST_PASSWORD,
      newPassword: 'un-altra-password-sintetica',
    });
    expect(changed.statusCode).toBe(200);
    const cookies = changed.cookies as { name: string; value: string }[];
    const renewed = cookies.find((c) => c.name === h.config.SESSION_COOKIE_NAME)!;
    const response = await h.app.inject({
      method: 'GET',
      url: '/auth/sessions',
      headers: { cookie: `${renewed.name}=${renewed.value}` },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('conferma recente per la gestione degli account (DR-391)', () => {
  const adminSession = async (): Promise<Session> => {
    const s = await login(ADMIN_EMAIL);
    const token = s.cookie.split(';')[0]!.split('=')[1]!;
    await verifySessionDirectly(h, token);
    const me = await get(s, '/auth/me');
    const role = me.json().rolesHeld[0];
    const chosen = await post(s, '/auth/context', { roleId: role.roleId, area: 'impostazioni' });
    expect(chosen.statusCode).toBe(200);
    return s;
  };

  it('passa con conferma recente, dopo 10 minuti chiede la conferma, poi passa con la password', async () => {
    const s = await adminSession();
    expect((await get(s, '/accounts')).statusCode).toBe(200);
    advance(9 * 60_000);
    expect((await get(s, '/accounts')).statusCode).toBe(200);
    advance(2 * 60_000);
    const stale = await get(s, '/accounts');
    expect(stale.statusCode).toBe(403);
    expect(stale.json().error.code).toBe('CONFIRMATION_REQUIRED');
    // Le altre rotte non ne risentono.
    expect((await get(s, '/auth/sessions')).statusCode).toBe(200);

    expect((await post(s, '/auth/confirm', { password: 'sbagliata' })).statusCode).toBe(403);
    expect((await get(s, '/accounts')).statusCode).toBe(403);
    expect((await post(s, '/auth/confirm', { password: TEST_PASSWORD })).statusCode).toBe(200);
    expect((await get(s, '/accounts')).statusCode).toBe(200);
  });

  it('dopo 10 minuti passa anche con la conferma tramite codice TOTP; password e codice insieme sono rifiutati', async () => {
    await enrol(ADMIN_EMAIL);
    const s = await login(ADMIN_EMAIL);
    await post(s, '/auth/second-factor/verify', { code: await codeFor(ADMIN_EMAIL, 1) });
    const me = await get(s, '/auth/me');
    await post(s, '/auth/context', { roleId: me.json().rolesHeld[0].roleId, area: 'impostazioni' });
    // Il login completo vale come conferma.
    expect((await get(s, '/accounts')).statusCode).toBe(200);
    advance(11 * 60_000);
    expect((await get(s, '/accounts')).json().error.code).toBe('CONFIRMATION_REQUIRED');
    expect(
      (await post(s, '/auth/confirm', { password: TEST_PASSWORD, code: '123456' })).statusCode,
    ).toBe(400);
    expect((await post(s, '/auth/confirm', { code: await codeFor(ADMIN_EMAIL) })).statusCode).toBe(
      200,
    );
    expect((await get(s, '/accounts')).statusCode).toBe(200);
  });

  it('una sessione non verificata non può confermare', async () => {
    const s = await login(ADMIN_EMAIL);
    const response = await post(s, '/auth/confirm', { password: TEST_PASSWORD });
    expect(response.json().error.code).toBe('SECOND_FACTOR_REQUIRED');
  });
});

describe('reimpostazione da CLI', () => {
  it('toglie il TOTP, chiude le sessioni e lascia una riga di registro senza segreti', async () => {
    const { session } = await enrol();
    const before = await h.db.select().from(schema.users).where(eq(schema.users.email, TEST_EMAIL));
    expect(before[0]!.totpActivatedAt).not.toBeNull();

    const revoked = await resetSecondFactor(h.db, TEST_EMAIL);
    expect(revoked).toBe(1);
    const [after] = await h.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, TEST_EMAIL));
    expect(after).toMatchObject({ totpSecretEnc: null, totpActivatedAt: null, totpLastStep: null });
    expect((await get(session, '/auth/me')).statusCode).toBe(204);

    const [row] = await h.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'auth.second_factor_reset'));
    expect(row).toMatchObject({ entityType: 'account', entityId: after!.id, outcome: 'success' });
    expect(dump(row)).not.toContain(before[0]!.totpSecretEnc!);
    expect(await resetSecondFactor(h.db, 'nessuno@esempio.invalid')).toBeNull();

    // Al prossimo accesso la persona attiva di nuovo.
    expect((await login()).body.secondFactor).toBe('activation_required');
  });
});

describe('nessun codice né segreto nei log e nel registro', () => {
  it('il flusso completo non lascia traccia di codici o segreti', async () => {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString('utf8'));
        done();
      },
    });
    const app = await buildApp(
      { ...h.config, LOG_LEVEL: 'info' },
      { objectStore: fakeObjectStore(), logStream },
    );
    await app.ready();
    try {
      const s = await login(TEST_EMAIL, TEST_PASSWORD, app);
      const setup = await post(s, '/auth/second-factor/setup', undefined, app);
      const secret: string = setup.json().secret;
      const good = await codeFor(TEST_EMAIL);
      await post(s, '/auth/second-factor/activate', { code: '654321' }, app);
      await post(s, '/auth/second-factor/activate', { code: good }, app);
      await post(s, '/auth/confirm', { code: '123456' }, app);

      const [user] = await h.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, TEST_EMAIL));
      const everything = lines.join('') + dump(await h.db.select().from(schema.auditLog));
      for (const secretValue of [
        good,
        '654321',
        '123456',
        secret,
        user!.totpSecretEnc!,
        h.config.TOTP_ENCRYPTION_KEY,
      ]) {
        expect(everything).not.toContain(secretValue);
      }
      expect(lines.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});

describe('configurazione di produzione', () => {
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://x/y',
    IP_HASH_SALT: 'a'.repeat(64),
    CSRF_SECRET: 'b'.repeat(64),
    TOTP_ENCRYPTION_KEY: 'c'.repeat(64),
    S3_ACCESS_KEY: 'chiave-sintetica',
    S3_SECRET_KEY: 'segreto-sintetico',
  };
  const problems = (env: Record<string, string>): string => {
    try {
      loadConfig(env);
    } catch (error) {
      if (error instanceof ConfigError) return error.problems.join('\n');
      throw error;
    }
    return '';
  };

  it('la chiave è obbligatoria, di 64 caratteri esadecimali e distinta dagli altri segreti', () => {
    expect(problems(base)).toBe('');
    const { TOTP_ENCRYPTION_KEY: _omitted, ...senza } = base;
    expect(problems(senza)).toContain('TOTP_ENCRYPTION_KEY');
    expect(problems({ ...base, TOTP_ENCRYPTION_KEY: 'c'.repeat(63) })).toContain(
      'TOTP_ENCRYPTION_KEY',
    );
    expect(problems({ ...base, TOTP_ENCRYPTION_KEY: 'z'.repeat(64) })).toContain(
      'TOTP_ENCRYPTION_KEY',
    );
    expect(problems({ ...base, TOTP_ENCRYPTION_KEY: base.IP_HASH_SALT })).toContain(
      'TOTP_ENCRYPTION_KEY',
    );
    expect(problems({ ...base, TOTP_ENCRYPTION_KEY: base.CSRF_SECRET })).toContain(
      'TOTP_ENCRYPTION_KEY',
    );
  });

  it('manca anche fuori produzione: è un segreto senza valore predefinito', () => {
    const { TOTP_ENCRYPTION_KEY: _omitted, ...senza } = base;
    expect(problems({ ...senza, NODE_ENV: 'development' })).toContain('TOTP_ENCRYPTION_KEY');
  });
});
