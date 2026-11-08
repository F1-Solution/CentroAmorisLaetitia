import { schema } from '@amoris/db';
import { and, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { identifierDigest, unblockAccount } from '../src/auth/loginAttempts.js';
import { addressPrefix, hashAddress } from '../src/lib/crypto.js';
import { createHarness, TEST_EMAIL, TEST_PASSWORD, type Harness } from './_support/harness.js';

/**
 * 1F-W4 T6h (R5, R6, R7, R8, R19, R28): conteggio dei tentativi, tetti HTTP anonimi,
 * digest dell'indirizzo, proxy fidato e user-agent. Solo dati sintetici.
 */

let h: Harness;
const SALT = 'sale-sintetico-per-i-test-abbastanza-lungo';
const OTHER_EMAIL = 'altro.sintetico@esempio.invalid';

/** Ogni accesso da un indirizzo nuovo: il tetto HTTP basso delle prove non entra nei casi di conteggio. */
let nextHost = 0;
const login = (
  password: string,
  headers: Record<string, string> = { 'x-forwarded-for': `192.0.2.${++nextHost % 250}` },
) =>
  h.app.inject({
    method: 'POST',
    url: '/auth/login',
    headers,
    payload: { email: TEST_EMAIL, password },
  });

const auditRows = (action: string) =>
  h.db.select().from(schema.auditLog).where(eq(schema.auditLog.action, action));

beforeAll(async () => {
  h = await createHarness('api_t6h', {
    LOGIN_MAX_PER_ACCOUNT: '3',
    LOGIN_MAX_PER_IP: '1000',
    HTTP_ANON_WRITES_PER_MINUTE: '4',
    HTTP_PUBLIC_READ_PER_MINUTE: '3',
  });
  await h.db.insert(schema.forms).values({
    slug: 'form-t6h',
    title: 'Form',
    definition: {
      fields: [{ id: 'nome', type: 'text', label: 'Nome', required: true, order: 0, options: {} }],
    },
  });
}, 120_000);

afterAll(async () => {
  await h?.teardown();
});

describe('R5: i rifiuti non allungano il blocco', () => {
  it('il blocco scade 15 minuti dopo l ultimo fallimento vero', async () => {
    for (let i = 0; i < 3; i++) expect((await login('sbagliata-sbagliata')).statusCode).toBe(401);
    // Rifiuti ripetuti, più della soglia: se contassero come fallimenti terrebbero su il blocco da soli.
    for (let i = 0; i < 4; i++) expect((await login(TEST_PASSWORD)).statusCode).toBe(429);
    const refused = await h.db
      .select()
      .from(schema.auditLog)
      .where(sql`${schema.auditLog.detail}->>'reason' = 'too_many_attempts'`);
    expect(refused.length).toBeGreaterThanOrEqual(4);

    // Invecchia i soli fallimenti veri di 16 minuti: i rifiuti recenti non tengono su il blocco.
    await h.db.execute(
      sql`update audit_log set occurred_at = now() - interval '16 minutes' where detail->>'reason' = 'invalid_credentials'`,
    );
    expect((await login(TEST_PASSWORD)).statusCode).toBe(200);
  });

  it('la CLI di sblocco agisce sul solo account indicato e scrive una riga', async () => {
    for (let i = 0; i < 3; i++) await login('sbagliata-sbagliata');
    expect((await login(TEST_PASSWORD)).statusCode).toBe(429);
    const cleared = await unblockAccount(h.db, h.config, TEST_EMAIL);
    expect(cleared).toBe(3);
    const rows = await auditRows('auth.login_unblocked');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityId).toBe(identifierDigest(TEST_EMAIL, SALT));
    expect(
      JSON.stringify(rows[0], (_key, value) => (typeof value === 'bigint' ? String(value) : value)),
    ).not.toContain(TEST_EMAIL);
    expect((await login(TEST_PASSWORD)).statusCode).toBe(200);
  });
});

describe('R7: digest dell email digitata', () => {
  it('non è lo SHA-256 semplice e cambia con il segreto', () => {
    const plain = createHash('sha256').update(TEST_EMAIL, 'utf8').digest('hex');
    expect(identifierDigest(TEST_EMAIL, SALT)).not.toBe(plain);
    expect(identifierDigest(TEST_EMAIL, SALT)).not.toBe(identifierDigest(TEST_EMAIL, `${SALT}-x`));
    expect(identifierDigest(` ${TEST_EMAIL.toUpperCase()} `, SALT)).toBe(
      identifierDigest(TEST_EMAIL, SALT),
    );
  });

  it('a registro il tentativo porta il digest con chiave', async () => {
    await login('sbagliata-sbagliata');
    const [row] = await h.db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.action, 'auth.login'), eq(schema.auditLog.outcome, 'failure')))
      .limit(1);
    expect(row?.entityId).toBe(identifierDigest(TEST_EMAIL, SALT));
  });
});

describe('R8: prefisso /64', () => {
  it('stesso /64 stesso digest, /64 diversi digest diversi, IPv4 mappato come IPv4', () => {
    const a = hashAddress('2001:db8:1:2:aaaa:bbbb:cccc:dddd', SALT);
    expect(hashAddress('2001:db8:1:2::1', SALT)).toEqual(a);
    expect(hashAddress('2001:DB8:1:2:0:0:0:9', SALT)).toEqual(a);
    expect(hashAddress('2001:db8:1:3::1', SALT)).not.toEqual(a);
    expect(hashAddress('::ffff:192.0.2.7', SALT)).toEqual(hashAddress('192.0.2.7', SALT));
    expect(addressPrefix('::ffff:c000:207')).toBe('192.0.2.7');
    expect(addressPrefix('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
  });

  it('due indirizzi dello stesso /64 condividono il tetto, un altro /64 no', async () => {
    const get = (ip: string) =>
      h.app.inject({
        method: 'GET',
        url: '/public/redirect?path=/non-esiste-r8',
        headers: { 'x-forwarded-for': ip },
      });
    for (const ip of ['2001:db8:a:b::1', '2001:db8:a:b::2', '2001:db8:a:b::3']) {
      expect((await get(ip)).statusCode).toBe(404);
    }
    expect((await get('2001:db8:a:b::4')).statusCode).toBe(429);
    expect((await get('2001:db8:a:c::1')).statusCode).toBe(404);
  });
});

describe('R6: tetti HTTP anonimi senza scritture a database', () => {
  it('oltre il tetto il login risponde 429 senza righe di registro in più', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.10' };
    for (let i = 0; i < 4; i++) await login('sbagliata-sbagliata', headers);
    const before = (await h.db.select().from(schema.auditLog)).length;
    const response = await login('sbagliata-sbagliata', headers);
    expect(response.statusCode).toBe(429);
    expect((await h.db.select().from(schema.auditLog)).length).toBe(before);
  });

  it('le chiamate dirette dalla rete interna, senza X-Forwarded-For, non condividono il tetto', async () => {
    for (let i = 0; i < 6; i++) {
      const response = await h.app.inject({
        method: 'GET',
        url: '/public/redirect?path=/x-interno',
      });
      expect(response.statusCode).toBe(404);
    }
  });

  it('form: 400 di validazione e 429 non scrivono né registro né compilazioni', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.20' };
    const post = (payload: object) =>
      h.app.inject({ method: 'POST', url: '/forms/form-t6h/submissions', headers, payload });
    const rows = () =>
      h.db
        .select()
        .from(schema.auditLog)
        .where(sql`action like 'POST /forms%'`);
    expect((await post({ values: {}, startedAt: Date.now() - 10_000 })).statusCode).toBe(400);
    expect((await post({ values: {}, startedAt: null })).statusCode).toBe(400);
    expect(await rows()).toHaveLength(0);
    await post({ values: {} });
    await post({ values: {} });
    const limited = await post({ values: {} });
    expect(limited.statusCode).toBe(429);
    expect(await rows()).toHaveLength(0);
    expect(await h.db.select().from(schema.formSubmissions)).toHaveLength(0);
  });

  it('gli indici per indirizzo esistono dopo la migrazione', async () => {
    const found = await h.db.execute<{ indexname: string }>(
      sql`select indexname from pg_indexes where indexname in ('audit_log_ip_idx', 'form_submissions_ip_idx')`,
    );
    expect(found.map((row) => row.indexname).sort()).toEqual([
      'audit_log_ip_idx',
      'form_submissions_ip_idx',
    ]);
  });
});

describe('R19: proxy fidato', () => {
  const loginFrom = (remoteAddress: string, xff: string) =>
    h.app.inject({
      method: 'POST',
      url: '/auth/login',
      remoteAddress,
      headers: { 'x-forwarded-for': xff },
      payload: { email: OTHER_EMAIL, password: 'sbagliata-sbagliata' },
    });
  const lastIpHash = async () => {
    const [row] = await h.db
      .select({ ipHash: schema.auditLog.ipHash })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, identifierDigest(OTHER_EMAIL, SALT)))
      .orderBy(sql`id desc`)
      .limit(1);
    return row?.ipHash;
  };

  it('da un indirizzo non fidato X-Forwarded-For è ignorato, da quello fidato vale', async () => {
    await loginFrom('203.0.113.9', '198.51.100.77');
    expect(await lastIpHash()).toEqual(hashAddress('203.0.113.9', SALT));
    await loginFrom('127.0.0.1', '198.51.100.77');
    expect(await lastIpHash()).toEqual(hashAddress('198.51.100.77', SALT));
  });
});

describe('R28: user-agent troncato', () => {
  it('un user-agent di 2000 caratteri si salva di 500', async () => {
    await h.app.inject({
      method: 'POST',
      url: '/forms/form-t6h/submissions',
      headers: { 'x-forwarded-for': '198.51.100.30', 'user-agent': 'a'.repeat(2000) },
      payload: { values: { nome: 'Sintetico' }, startedAt: Date.now() - 10_000 },
    });
    const [row] = await h.db.select().from(schema.formSubmissions);
    expect(row?.userAgent).toHaveLength(500);
  });
});
