import { schema } from '@amoris/db';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { oneAtATime } from '../src/auth/loginAttempts.js';
import { hotp, openSecret, STEP_SECONDS } from '../src/auth/totp.js';
import {
  createHarness,
  TEST_EMAIL,
  TEST_PASSWORD,
  verifySessionDirectly,
  type Harness,
} from './_support/harness.js';

/**
 * 1F-W4 T7, rilievo N1 (DR-400): con richieste parallele tutte le letture del conteggio arrivavano prima della
 * prima scrittura del fallimento, e il tetto per account si superava. Qui le raffiche partono insieme: i
 * fallimenti registrati devono essere esattamente il tetto, in ogni punto che conta i tentativi.
 */

let h: Harness;
let passwordHash: string;

beforeAll(async () => {
  // Il tetto per indirizzo resta alto: le prove misurano quello per account, tutte da 127.0.0.1.
  h = await createHarness('api_t7_race', { LOGIN_MAX_PER_IP: '1000' });
  const [user] = await h.db.select().from(schema.users).where(eq(schema.users.email, TEST_EMAIL));
  passwordHash = user!.passwordHash!;
}, 120_000);

afterAll(async () => {
  await h?.teardown();
});

afterEach(async () => {
  await h.db
    .update(schema.users)
    .set({ totpSecretEnc: null, totpActivatedAt: null, totpLastStep: null, passwordHash });
  await h.db.delete(schema.sessions);
  await h.db.delete(schema.auditLog);
});

interface Session {
  readonly token: string;
  readonly headers: Record<string, string>;
}

async function login(): Promise<Session> {
  const response = await h.app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  const cookies = response.cookies as { name: string; value: string }[];
  const session = cookies.find((c) => c.name === h.config.SESSION_COOKIE_NAME)!;
  const csrf = cookies.find((c) => c.name === h.config.CSRF_COOKIE_NAME)!;
  const cookie = `${session.name}=${session.value}; ${csrf.name}=${csrf.value}`;
  return { token: session.value, headers: { cookie, 'x-csrf-token': csrf.value } };
}

const post = (s: Session, url: string, payload: object) =>
  h.app.inject({ method: 'POST', url, headers: s.headers, payload });

/** Un codice sicuramente sbagliato: diverso da quelli validi nella finestra di ±1 passo. */
async function wrongCode(): Promise<string> {
  const [user] = await h.db.select().from(schema.users).where(eq(schema.users.email, TEST_EMAIL));
  const secret = openSecret(user!.totpSecretEnc!, h.config.TOTP_ENCRYPTION_KEY, user!.id);
  const step = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  const valid = new Set([-1, 0, 1, 2].map((offset) => hotp(secret, step + offset)));
  for (let candidate = 0; ; candidate += 1) {
    const code = String(candidate).padStart(6, '0');
    if (!valid.has(code)) return code;
  }
}

async function enrol(): Promise<void> {
  const s = await login();
  expect((await post(s, '/auth/second-factor/setup', {})).statusCode).toBe(200);
  const [user] = await h.db.select().from(schema.users).where(eq(schema.users.email, TEST_EMAIL));
  const secret = openSecret(user!.totpSecretEnc!, h.config.TOTP_ENCRYPTION_KEY, user!.id);
  const code = hotp(secret, Math.floor(Date.now() / 1000 / STEP_SECONDS));
  expect((await post(s, '/auth/second-factor/activate', { code })).statusCode).toBe(200);
}

const failures = (action: string, reason?: string) =>
  h.db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.action, action),
        eq(schema.auditLog.outcome, 'failure'),
        reason
          ? sql`${schema.auditLog.detail}->>'reason' = ${reason}`
          : sql`coalesce(${schema.auditLog.detail}->>'reason', '') <> 'too_many_attempts'`,
      ),
    )
    .then(([row]) => row?.count ?? 0);

/** `perSession` richieste per ciascuna sessione, tutte avviate insieme; restituisce i codici di stato. */
async function burst(
  sessions: readonly Session[],
  perSession: number,
  send: (s: Session) => ReturnType<typeof post>,
): Promise<number[]> {
  const all = sessions.flatMap((s) => Array.from({ length: perSession }, () => send(s)));
  return (await Promise.all(all)).map((response) => response.statusCode);
}

describe('N1: conteggio esatto dei tentativi con richieste parallele', () => {
  it('codice del secondo fattore: una raffica parallela non supera il tetto per account', async () => {
    await enrol();
    const sessions = [await login(), await login(), await login(), await login()];
    const code = await wrongCode();
    const statuses = await burst(sessions, 8, (s) =>
      post(s, '/auth/second-factor/verify', { code }),
    );

    expect(await failures('auth.second_factor')).toBe(h.config.LOGIN_MAX_PER_ACCOUNT);
    expect(statuses.filter((status) => status === 403)).toHaveLength(
      h.config.LOGIN_MAX_PER_ACCOUNT,
    );
    expect(statuses.every((status) => status === 403 || status === 429)).toBe(true);
  });

  it('conferma con il codice: stessa coda della verifica', async () => {
    await enrol();
    const sessions = [await login(), await login()];
    for (const s of sessions) await verifySessionDirectly(h, s.token);
    const code = await wrongCode();
    await burst(sessions, 8, (s) => post(s, '/auth/confirm', { code }));

    expect(await failures('auth.second_factor')).toBe(h.config.LOGIN_MAX_PER_ACCOUNT);
  });

  it('password attuale (cambio password e conferma): una raffica parallela non supera il tetto', async () => {
    const sessions = [await login(), await login()];
    for (const s of sessions) await verifySessionDirectly(h, s.token);
    await burst(sessions, 4, (s) =>
      post(s, '/auth/password', {
        currentPassword: 'sbagliata-sbagliata',
        newPassword: 'nuova-password-sintetica',
      }),
    );
    await burst(sessions, 4, (s) => post(s, '/auth/confirm', { password: 'sbagliata-sbagliata' }));

    expect(await failures('auth.password_changed')).toBe(h.config.LOGIN_MAX_PER_ACCOUNT);
  });

  it('accesso: una raffica parallela di password sbagliate registra solo il tetto', async () => {
    const statuses = await Promise.all(
      Array.from({ length: 12 }, () =>
        h.app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: TEST_EMAIL, password: 'sbagliata-sbagliata' },
        }),
      ),
    );

    expect(await failures('auth.login', 'invalid_credentials')).toBe(
      h.config.LOGIN_MAX_PER_ACCOUNT,
    );
    expect(statuses.filter((r) => r.statusCode === 401)).toHaveLength(
      h.config.LOGIN_MAX_PER_ACCOUNT,
    );
  });
});

describe('N1: tetto HTTP per sessione sulle rotte del codice e della conferma', () => {
  it("l'undicesima richiesta nello stesso minuto dalla stessa sessione è rifiutata prima del conteggio", async () => {
    await enrol();
    const s = await login();
    const code = await wrongCode();
    const codes: string[] = [];
    for (let i = 0; i < 11; i += 1) {
      const response = await post(s, '/auth/second-factor/verify', { code });
      codes.push(
        response.statusCode === 429 ? response.json().error.code : String(response.statusCode),
      );
    }
    expect(codes.slice(0, 10)).not.toContain('TOO_MANY_REQUESTS');
    expect(codes[10]).toBe('TOO_MANY_REQUESTS');

    // Un'altra sessione ha il suo tetto: il rifiuto per sessione non blocca le altre.
    const other = await login();
    const response = await post(other, '/auth/second-factor/verify', { code });
    expect(response.json().error.code).not.toBe('TOO_MANY_REQUESTS');
  });

  it('vale anche per la conferma', async () => {
    const s = await login();
    await verifySessionDirectly(h, s.token);
    const codes: string[] = [];
    for (let i = 0; i < 11; i += 1) {
      const response = await post(s, '/auth/confirm', { code: '000000' });
      codes.push(
        response.statusCode === 429 ? response.json().error.code : String(response.statusCode),
      );
    }
    expect(codes[10]).toBe('TOO_MANY_REQUESTS');
  });
});

describe('N1: la coda per account', () => {
  it('serializza per account, un errore non ferma la coda e account diversi non si attendono', async () => {
    const order: string[] = [];
    const work = (label: string, ms: number) => async () => {
      order.push(`${label}+`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      order.push(`${label}-`);
      return label;
    };
    const first = oneAtATime('Uno@esempio.invalid', work('a', 40));
    const broken = oneAtATime(' uno@ESEMPIO.invalid ', () => Promise.reject(new Error('rotto')));
    const third = oneAtATime('uno@esempio.invalid', work('c', 1));
    const other = oneAtATime('due@esempio.invalid', work('d', 1));
    await expect(broken).rejects.toThrow('rotto');
    expect(await Promise.all([first, third, other])).toEqual(['a', 'c', 'd']);
    expect(order.indexOf('a-')).toBeLessThan(order.indexOf('c+'));
    expect(order.indexOf('d-')).toBeLessThan(order.indexOf('a-'));
  });
});
