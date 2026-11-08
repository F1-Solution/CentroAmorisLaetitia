import { schema } from '@amoris/db';
import { eq, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import {
  createHarness,
  signIn,
  TEST_EMAIL,
  TEST_PASSWORD,
  type Harness,
} from './_support/harness.js';

/** 1F-W4 T6j (R26a, R26c, R27): `no-store`, cambio password atomico e configurazione di produzione. Solo dati sintetici. */

let h: Harness;

beforeAll(async () => {
  h = await createHarness('api_t6j', { LOGIN_MAX_PER_IP: '1000' });
}, 120_000);

afterAll(async () => {
  await h?.teardown();
});

describe('R26c: le risposte con dati di sessione non restano in cache', () => {
  it('/auth/me e /auth/sessions rispondono con Cache-Control: no-store', async () => {
    const signed = await signIn(h);
    for (const url of ['/auth/me', '/auth/sessions']) {
      const reply = await h.app.inject({ method: 'GET', url, headers: { cookie: signed.cookie } });
      expect(reply.statusCode, url).toBe(200);
      expect(reply.headers['cache-control'], url).toBe('no-store');
    }
  });

  it('anche senza sessione /auth/me (204) non va in cache', async () => {
    const reply = await h.app.inject({ method: 'GET', url: '/auth/me' });
    expect(reply.statusCode).toBe(204);
    expect(reply.headers['cache-control']).toBe('no-store');
  });
});

describe('R26a: cambio password e revoca delle altre sessioni in una transazione', () => {
  it('se la revoca fallisce la password resta quella di prima', async () => {
    const signed = await signIn(h);
    await signIn(h);
    await h.db.execute(sql`
      create function t6j_fail() returns trigger language plpgsql as $$ begin raise exception 'guasto iniettato'; end $$`);
    await h.db.execute(
      sql`create trigger t6j_block before update on sessions for each row when (new.revoked_at is not null) execute function t6j_fail()`,
    );
    try {
      const reply = await h.app.inject({
        method: 'POST',
        url: '/auth/password',
        headers: signed.writeHeaders,
        payload: { currentPassword: TEST_PASSWORD, newPassword: 'nuova-password-sintetica-77' },
      });
      expect(reply.statusCode).toBe(500);
    } finally {
      await h.db.execute(sql`drop trigger t6j_block on sessions`);
      await h.db.execute(sql`drop function t6j_fail()`);
    }
    // La vecchia password vale ancora e nessuna sessione è stata revocata a metà.
    const [user] = await h.db.select().from(schema.users).where(eq(schema.users.email, TEST_EMAIL));
    expect(user?.mustChangePassword).toBe(false);
    const login = await h.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const live = await h.db.select().from(schema.sessions).where(isNull(schema.sessions.revokedAt));
    expect(live.length).toBeGreaterThanOrEqual(3);
  });
});

describe('R27: configurazione di produzione', () => {
  const salt = 'a'.repeat(32);
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://x/y',
    IP_HASH_SALT: salt,
    CSRF_SECRET: 'b'.repeat(32),
    TOTP_ENCRYPTION_KEY: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
    S3_ACCESS_KEY: 'chiave-sintetica',
    S3_SECRET_KEY: 'segreto-sintetico',
  };
  const problems = (env: Record<string, string>): readonly string[] => {
    try {
      loadConfig(env);
    } catch (error) {
      if (error instanceof ConfigError) return error.problems;
      throw error;
    }
    return [];
  };

  it('una configurazione completa passa', () => {
    expect(problems(base)).toEqual([]);
  });

  it('senza chiavi S3 non parte, vuote comprese', () => {
    expect(problems({ ...base, S3_ACCESS_KEY: '' }).join()).toContain('S3_ACCESS_KEY');
    const { S3_SECRET_KEY: _omitted, ...senza } = base;
    expect(problems(senza).join()).toContain('S3_SECRET_KEY');
  });

  it('rifiuta memoria Argon2 sotto 19 MiB e meno di 2 iterazioni', () => {
    expect(problems({ ...base, ARGON2_MEMORY_KIB: '8192' }).join()).toContain('ARGON2_MEMORY_KIB');
    expect(problems({ ...base, ARGON2_TIME_COST: '1' }).join()).toContain('ARGON2_TIME_COST');
  });

  it('rifiuta segreti uguali fra loro', () => {
    expect(problems({ ...base, CSRF_SECRET: salt }).join()).toContain('CSRF_SECRET');
    const token = { SCRUB_SERVICE_URL: 'http://scrub:3003', SCRUB_SERVICE_TOKEN: salt };
    expect(problems({ ...base, ...token }).join()).toContain('SCRUB_SERVICE_TOKEN');
  });

  it('in sviluppo e nelle prove i valori attuali restano accettati', () => {
    const dev = {
      DATABASE_URL: 'postgres://x/y',
      IP_HASH_SALT: salt,
      CSRF_SECRET: salt,
      TOTP_ENCRYPTION_KEY: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
      ARGON2_MEMORY_KIB: '8192',
    };
    expect(problems(dev)).toEqual([]);
    expect(problems({ ...dev, NODE_ENV: 'test' })).toEqual([]);
  });
});
