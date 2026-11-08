import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
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

/** 1F-W4 T6k (R9, DR-391): sessione di 14 giorni, 8 ore di inattività, cookie di sessione del browser. Solo dati sintetici. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let h: Harness;

beforeAll(async () => {
  h = await createHarness('api_t6k', { LOGIN_MAX_PER_IP: '1000' });
}, 120_000);

afterAll(async () => {
  await h?.teardown();
});

async function ageSession(
  cookie: string,
  values: { lastSeenAt?: Date; issuedAt?: Date; expiresAt?: Date },
): Promise<void> {
  const token = cookie.split('; ')[0]?.split('=').slice(1).join('=') ?? '';
  await h.db
    .update(schema.sessions)
    .set(values)
    .where(eq(schema.sessions.tokenDigest, tokenDigest(token)));
}

async function isValid(cookie: string): Promise<boolean> {
  const me = await h.app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
  return me.statusCode === 200;
}

describe('R9: i cookie vivono quanto il browser', () => {
  it('né il cookie di sessione né quello anti-CSRF hanno Max-Age o Expires', async () => {
    const reply = await h.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(reply.statusCode).toBe(200);
    const headers = [reply.headers['set-cookie']].flat().filter(Boolean) as string[];
    expect(headers).toHaveLength(2);
    for (const header of headers) {
      expect(header, header).not.toMatch(/max-age/i);
      expect(header, header).not.toMatch(/expires/i);
    }
  });

  it('il logout continua a cancellare entrambi i cookie', async () => {
    const signed = await signIn(h);
    const reply = await h.app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: signed.writeHeaders,
    });
    const headers = [reply.headers['set-cookie']].flat().join('\n');
    expect(headers).toContain(`${h.config.SESSION_COOKIE_NAME}=;`);
    expect(headers).toContain(`${h.config.CSRF_COOKIE_NAME}=;`);
    expect(headers).toMatch(/expires=Thu, 01 Jan 1970/i);
  });
});

describe('R9: scadenze predefinite lato server', () => {
  it('i valori predefiniti sono 14 giorni e 8 ore', () => {
    expect(h.config.SESSION_ABSOLUTE_DAYS).toBe(14);
    expect(h.config.SESSION_IDLE_HOURS).toBe(8);
  });

  it('inattiva da poco più di 8 ore: rifiutata; da poco meno: valida', async () => {
    const stale = await signIn(h);
    await ageSession(stale.cookie, { lastSeenAt: new Date(Date.now() - 8 * HOUR - 60_000) });
    expect(await isValid(stale.cookie)).toBe(false);

    const fresh = await signIn(h);
    await ageSession(fresh.cookie, { lastSeenAt: new Date(Date.now() - 8 * HOUR + 60_000) });
    expect(await isValid(fresh.cookie)).toBe(true);
  });

  it('attiva da 13 giorni resta valida; creata da poco più di 14 giorni è rifiutata', async () => {
    const active = await signIn(h);
    await ageSession(active.cookie, { issuedAt: new Date(Date.now() - 13 * DAY) });
    expect(await isValid(active.cookie)).toBe(true);

    const expired = await signIn(h);
    const issuedAt = new Date(Date.now() - 14 * DAY - 60_000);
    await ageSession(expired.cookie, {
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + 14 * DAY),
    });
    expect(await isValid(expired.cookie)).toBe(false);
  });

  it('una nuova sessione scade dopo 14 giorni dall’emissione', async () => {
    const signed = await signIn(h);
    const token = signed.cookie.split('; ')[0]?.split('=').slice(1).join('=') ?? '';
    const [row] = await h.db
      .select({ expiresAt: schema.sessions.expiresAt, issuedAt: schema.sessions.issuedAt })
      .from(schema.sessions)
      .where(eq(schema.sessions.tokenDigest, tokenDigest(token)));
    const span = (row?.expiresAt.getTime() ?? 0) - (row?.issuedAt.getTime() ?? 0);
    expect(Math.abs(span - 14 * DAY)).toBeLessThan(5_000);
  });
});

describe('R9: in produzione le scadenze non superano DR-391', () => {
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://x/y',
    IP_HASH_SALT: 'a'.repeat(32),
    CSRF_SECRET: 'b'.repeat(32),
    TOTP_ENCRYPTION_KEY: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
    S3_ACCESS_KEY: 'chiave-sintetica',
    S3_SECRET_KEY: 'segreto-sintetico',
  };
  const problems = (env: Record<string, string>): string => {
    try {
      loadConfig(env);
    } catch (error) {
      if (error instanceof ConfigError) return error.problems.join();
      throw error;
    }
    return '';
  };

  it('15 giorni o 9 ore sono rifiutati, 14 e 8 passano', () => {
    expect(problems({ ...base, SESSION_ABSOLUTE_DAYS: '15' })).toContain('SESSION_ABSOLUTE_DAYS');
    expect(problems({ ...base, SESSION_IDLE_HOURS: '9' })).toContain('SESSION_IDLE_HOURS');
    expect(problems({ ...base, SESSION_ABSOLUTE_DAYS: '14', SESSION_IDLE_HOURS: '8' })).toBe('');
    expect(problems({ ...base, SESSION_ABSOLUTE_DAYS: '1', SESSION_IDLE_HOURS: '1' })).toBe('');
  });

  it('fuori produzione i valori più lunghi restano ammessi', () => {
    const dev = {
      ...base,
      NODE_ENV: 'test',
      SESSION_ABSOLUTE_DAYS: '30',
      SESSION_IDLE_HOURS: '12',
    };
    expect(problems(dev)).toBe('');
  });
});
