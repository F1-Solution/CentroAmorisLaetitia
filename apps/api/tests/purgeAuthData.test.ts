import { schema } from '@amoris/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { purgeAuthData } from '../src/maintenance/purgeAuthData.js';
import { createHarness, type Harness } from './_support/harness.js';

/** 1F-W4 T6j (R25): la pulizia toglie solo sessioni vecchie e fallimenti d'accesso vecchi. Righe sintetiche. */

let h: Harness;
const DAY = 86_400_000;
const ago = (days: number): Date => new Date(Date.now() - days * DAY);

beforeAll(async () => {
  h = await createHarness('api_t6j_purge');
}, 120_000);

afterAll(async () => {
  await h?.teardown();
});

const session = (expiresAt: Date, revokedAt: Date | null) => ({
  userId: h.userId,
  tokenDigest: Buffer.from(crypto.randomUUID()),
  expiresAt,
  revokedAt,
});
const audit = (action: string, outcome: 'success' | 'failure', days: number, reason?: string) => ({
  action,
  outcome,
  occurredAt: ago(days),
  detail: reason ? { reason } : {},
});

describe('purgeAuthData', () => {
  it("cancella sessioni scadute o revocate da più di 30 giorni e fallimenti d'accesso vecchi, nient'altro", async () => {
    const inserted = await h.db
      .insert(schema.sessions)
      .values([
        session(ago(31), null), // scaduta da 31 giorni: via
        session(ago(5), ago(31)), // revocata da 31 giorni: via
        session(ago(29), null), // scaduta da 29 giorni: resta
        session(ago(5), ago(29)), // revocata da 29 giorni: resta
        session(new Date(Date.now() + DAY), null), // viva: resta
      ])
      .returning({ id: schema.sessions.id });
    expect(inserted).toHaveLength(5);

    await h.db.insert(schema.auditLog).values([
      audit('auth.login', 'failure', 31, 'invalid_credentials'), // via
      audit('auth.login', 'failure', 40, 'too_many_attempts'), // via
      audit('auth.login', 'failure', 29, 'invalid_credentials'), // resta
      audit('auth.login', 'success', 90), // resta
      audit('auth.password_changed', 'failure', 90, 'invalid_credentials'), // resta
      audit('account.create', 'success', 400), // resta
    ]);

    const result = await purgeAuthData(h.db);
    expect(result).toEqual({ sessions: 2, loginFailures: 2 });

    const left = await h.db.select({ id: schema.sessions.id }).from(schema.sessions);
    expect(left).toHaveLength(3);
    const rows = await h.db
      .select({ action: schema.auditLog.action, outcome: schema.auditLog.outcome })
      .from(schema.auditLog)
      .where(sql`${schema.auditLog.occurredAt} < now() - interval '28 days'`);
    expect(rows.map((row) => `${row.action}/${row.outcome}`).sort()).toEqual([
      'account.create/success',
      'auth.login/failure',
      'auth.login/success',
      'auth.password_changed/failure',
    ]);
  });

  it('una seconda esecuzione non trova più nulla', async () => {
    expect(await purgeAuthData(h.db)).toEqual({ sessions: 0, loginFailures: 0 });
    const [count] = await h.db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'account.create'));
    expect(count?.n).toBe(1);
  });
});
