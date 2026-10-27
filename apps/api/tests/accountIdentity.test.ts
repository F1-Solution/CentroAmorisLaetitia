import { schema } from '@amoris/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  ADMIN_EMAIL,
  TEST_EMAIL,
  createHarness,
  fakeObjectStore,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W7, T2i (DR-282): da «Persone e permessi» si modificano nome ed email
 * di un account. Cambiare l'email chiude tutte le sessioni della persona, come la
 * reimpostazione della password (ADR-007 §3.1 controllo 6); il registro porta i
 * nomi dei campi cambiati e mai i valori. Solo indirizzi `*@example.invalid`.
 */

const NEW_PASSWORD = 'password-definitiva-sintetica';

let harness: Harness;
let admin: Signed;

beforeAll(async () => {
  harness = await createHarness('api_account_identity');
  admin = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

interface AccountBody {
  id: string;
  email: string;
  fullName: string;
}

async function createAccount(
  h: Harness,
  signed: Signed,
  email: string,
  roleKeys: string[] = ['editor'],
): Promise<{ account: AccountBody; temporaryPassword: string }> {
  const risposta = await h.app.inject({
    method: 'POST',
    url: '/accounts',
    headers: signed.writeHeaders,
    payload: { email, fullName: 'Persona Sintetica', roleKeys },
  });
  expect(risposta.statusCode, risposta.body).toBe(201);
  return risposta.json();
}

/** Primo accesso, cambio obbligatorio della password, poi ingresso nell'area. */
async function activate(
  h: Harness,
  email: string,
  temporaryPassword: string,
  area: 'redazione' | 'impostazioni',
): Promise<Signed> {
  const first = await signIn(h, { email, password: temporaryPassword, area: null });
  const cambio = await h.app.inject({
    method: 'POST',
    url: '/auth/password',
    headers: first.writeHeaders,
    payload: { currentPassword: temporaryPassword, newPassword: NEW_PASSWORD },
  });
  expect(cambio.statusCode, cambio.body).toBe(200);
  return signIn(h, { email, password: NEW_PASSWORD, area });
}

function patch(h: Harness, headers: Record<string, string>, id: string, payload: unknown) {
  return h.app.inject({ method: 'PATCH', url: `/accounts/${id}`, headers, payload });
}

function login(h: Harness, email: string, password: string) {
  return h.app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
}

async function liveSessions(userId: string) {
  return harness.db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}

async function updateRows(entityId: string) {
  return harness.db
    .select()
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.action, 'account.update'), eq(schema.auditLog.entityId, entityId)),
    );
}

describe('PATCH /accounts/:id con l’email (DR-282)', () => {
  it('sessione chiusa 401, con la sola Redazione 403, senza token anti-CSRF 403', async () => {
    const { account } = await createAccount(harness, admin, 'protetta@example.invalid');
    const payload = { email: 'altra.protetta@example.invalid' };

    // Senza alcun cookie il controllo anti-CSRF risponde per primo (403), come
    // per ogni scrittura; il 401 si vede con una sessione chiusa e token coerente.
    const anonima = await patch(harness, {}, account.id, payload);
    expect(anonima.statusCode).toBe(403);
    const chiusa = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
    const uscita = await harness.app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: chiusa.writeHeaders,
    });
    expect(uscita.statusCode).toBeLessThan(300);
    const scaduta = await patch(harness, chiusa.writeHeaders, account.id, payload);
    expect(scaduta.statusCode).toBe(401);

    const redazione = await signIn(harness, { email: TEST_EMAIL, area: 'redazione' });
    const vietata = await patch(harness, redazione.writeHeaders, account.id, payload);
    expect(vietata.statusCode).toBe(403);

    const senzaCsrf = await patch(harness, { cookie: admin.cookie }, account.id, payload);
    expect(senzaCsrf.statusCode).toBe(403);
    expect(senzaCsrf.json().error.code).toBe('CSRF_TOKEN_INVALID');

    const [row] = await harness.db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, account.id));
    expect(row?.email).toBe('protetta@example.invalid');
  });

  it('cambia nome ed email: l’indirizzo si salva normalizzato, si entra col nuovo e non col vecchio', async () => {
    const created = await createAccount(harness, admin, 'vecchia@example.invalid');
    await activate(harness, 'vecchia@example.invalid', created.temporaryPassword, 'redazione');

    const risposta = await patch(harness, admin.writeHeaders, created.account.id, {
      fullName: 'Nome Nuovo',
      email: '  Nuova.Persona@Example.Invalid ',
    });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().account).toMatchObject({
      fullName: 'Nome Nuovo',
      email: 'nuova.persona@example.invalid',
    });

    expect((await login(harness, 'nuova.persona@example.invalid', NEW_PASSWORD)).statusCode).toBe(
      200,
    );
    expect((await login(harness, 'vecchia@example.invalid', NEW_PASSWORD)).statusCode).toBe(401);
  });

  it('rifiuta con 409 in italiano un indirizzo già usato, anche con maiuscole diverse', async () => {
    await createAccount(harness, admin, 'occupata@example.invalid');
    const { account } = await createAccount(harness, admin, 'libera@example.invalid');

    const risposta = await patch(harness, admin.writeHeaders, account.id, {
      email: 'OCCUPATA@example.invalid',
    });
    expect(risposta.statusCode).toBe(409);
    expect(risposta.json().error).toMatchObject({
      code: 'EMAIL_TAKEN',
      message: 'Esiste già un account con questo indirizzo.',
    });
  });

  it('dopo un 409 email, nome e sessioni della persona restano com’erano', async () => {
    await createAccount(harness, admin, 'presa.prima@example.invalid');
    const created = await createAccount(harness, admin, 'intatta@example.invalid');
    const persona = await activate(
      harness,
      'intatta@example.invalid',
      created.temporaryPassword,
      'redazione',
    );
    const prima = (await liveSessions(created.account.id)).length;
    expect(prima).toBeGreaterThan(0);

    const risposta = await patch(harness, admin.writeHeaders, created.account.id, {
      fullName: 'Nome Che Non Resta',
      email: 'presa.prima@example.invalid',
    });
    expect(risposta.statusCode).toBe(409);

    const [row] = await harness.db
      .select({ email: schema.users.email, fullName: schema.users.fullName })
      .from(schema.users)
      .where(eq(schema.users.id, created.account.id));
    expect(row).toEqual({ email: 'intatta@example.invalid', fullName: 'Persona Sintetica' });
    expect(await liveSessions(created.account.id)).toHaveLength(prima);
    const ancora = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: persona.cookie },
    });
    expect(ancora.statusCode).toBe(200);
  });

  it('rifiuta con 400 un indirizzo non valido o vuoto e un nome vuoto', async () => {
    const { account } = await createAccount(harness, admin, 'formato@example.invalid');
    for (const payload of [{ email: 'non-un-indirizzo' }, { email: '' }, { fullName: '   ' }]) {
      const risposta = await patch(harness, admin.writeHeaders, account.id, payload);
      expect(risposta.statusCode, JSON.stringify(payload)).toBe(400);
    }
  });

  it('cambiare l’email chiude tutte le sessioni della persona; la sessione dopo è 401', async () => {
    const created = await createAccount(harness, admin, 'sessioni@example.invalid');
    const persona = await activate(
      harness,
      'sessioni@example.invalid',
      created.temporaryPassword,
      'redazione',
    );
    // Una seconda sessione aperta: si chiudono tutte, non solo l'ultima.
    await signIn(harness, { email: 'sessioni@example.invalid', password: NEW_PASSWORD });
    expect((await liveSessions(created.account.id)).length).toBeGreaterThanOrEqual(2);

    const risposta = await patch(harness, admin.writeHeaders, created.account.id, {
      email: 'sessioni.nuove@example.invalid',
    });
    expect(risposta.statusCode).toBe(200);
    expect(await liveSessions(created.account.id)).toHaveLength(0);

    const dopo = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: persona.cookie },
    });
    expect(dopo.statusCode).toBe(401);
  });

  it('il solo nome, o la stessa email con maiuscole diverse, non chiude le sessioni', async () => {
    const created = await createAccount(harness, admin, 'resta@example.invalid');
    const persona = await activate(
      harness,
      'resta@example.invalid',
      created.temporaryPassword,
      'redazione',
    );
    const risposta = await patch(harness, admin.writeHeaders, created.account.id, {
      fullName: 'Solo il Nome',
      email: 'RESTA@example.invalid',
    });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().account.email).toBe('resta@example.invalid');
    const ancora = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: persona.cookie },
    });
    expect(ancora.statusCode).toBe(200);

    const [row] = await updateRows(created.account.id);
    expect(row?.detail).toMatchObject({ fields: ['fullName'] });
  });

  it('regola per la propria email: si può cambiare, e chiude anche la sessione in uso', async () => {
    const created = await createAccount(harness, admin, 'seconda.admin@example.invalid', [
      'amministrazione',
    ]);
    const seconda = await activate(
      harness,
      'seconda.admin@example.invalid',
      created.temporaryPassword,
      'impostazioni',
    );

    // Sul proprio account serve la password attuale (DR-288).
    const risposta = await patch(harness, seconda.writeHeaders, created.account.id, {
      email: 'seconda.admin.nuova@example.invalid',
      currentPassword: NEW_PASSWORD,
    });
    expect(risposta.statusCode, risposta.body).toBe(200);

    const dopo = await harness.app.inject({
      method: 'GET',
      url: '/accounts',
      headers: { cookie: seconda.cookie },
    });
    expect(dopo.statusCode).toBe(401);
    expect(
      (await login(harness, 'seconda.admin.nuova@example.invalid', NEW_PASSWORD)).statusCode,
    ).toBe(200);
  });
});

describe('registro e log senza indirizzi (DR-282)', () => {
  it('account.update porta i nomi dei campi cambiati, mai i valori vecchi o nuovi', async () => {
    const created = await createAccount(harness, admin, 'registro.vecchia@example.invalid');
    const risposta = await patch(harness, admin.writeHeaders, created.account.id, {
      fullName: 'Nome Registrato',
      email: 'registro.nuova@example.invalid',
    });
    expect(risposta.statusCode).toBe(200);

    const rows = await updateRows(created.account.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.detail).toMatchObject({
      accountId: created.account.id,
      fields: ['email', 'fullName'],
    });
    const detail = JSON.stringify(rows[0]?.detail);
    expect(detail).not.toContain('@');
    expect(detail).not.toContain('registro.vecchia');
    expect(detail).not.toContain('registro.nuova');
    expect(detail).not.toContain('Nome Registrato');
  });

  it('il rifiuto per indirizzo già usato non scrive l’indirizzo nel registro', async () => {
    await createAccount(harness, admin, 'gia.presa@example.invalid');
    const { account } = await createAccount(harness, admin, 'tentativo@example.invalid');
    const risposta = await patch(harness, admin.writeHeaders, account.id, {
      email: 'gia.presa@example.invalid',
    });
    expect(risposta.statusCode).toBe(409);
    const rows = await updateRows(account.id);
    expect(JSON.stringify(rows.map((row) => row.detail))).not.toContain('@');
  });

  it('nessuna delle due email compare nei log, nemmeno a livello trace', async () => {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString('utf8'));
        done();
      },
    });
    const traced = await buildApp(
      { ...harness.config, LOG_LEVEL: 'trace' },
      { objectStore: fakeObjectStore(), logStream },
    );
    await traced.ready();
    try {
      const tracedHarness = { ...harness, app: traced } as Harness;
      const signed = await signIn(tracedHarness, { email: ADMIN_EMAIL, area: 'impostazioni' });
      const created = await createAccount(tracedHarness, signed, 'log.vecchia@example.invalid');
      lines.length = 0;
      const ok = await patch(tracedHarness, signed.writeHeaders, created.account.id, {
        email: 'log.nuova@example.invalid',
      });
      expect(ok.statusCode).toBe(200);
      const clash = await patch(tracedHarness, signed.writeHeaders, created.account.id, {
        email: ADMIN_EMAIL,
      });
      expect(clash.statusCode).toBe(409);

      const log = lines.join('');
      // Il logger ha davvero scritto: altrimenti la prova passerebbe a vuoto.
      expect(log).toContain('/accounts/');
      expect(log).not.toContain('log.vecchia');
      expect(log).not.toContain('log.nuova');
      expect(log).not.toContain(ADMIN_EMAIL);
    } finally {
      await traced.close();
    }
  });
});

describe('errore imprevisto del database senza indirizzi nel log (giro 1)', () => {
  it('creazione e modifica falliscono con 500 e il log non porta né la query né l’indirizzo', async () => {
    // Un innesco simula un guasto qualsiasi (non 23505) sugli indirizzi «guasto.*»:
    // l'errore di Drizzle porterebbe nel messaggio la query e i parametri, quindi l'email.
    await harness.db.execute(sql`
      create or replace function t2i_guasto() returns trigger language plpgsql as $$
      begin
        if new.email like 'guasto.%' then
          raise exception 'guasto simulato' using errcode = 'P0001';
        end if;
        return new;
      end $$`);
    await harness.db.execute(sql`
      create trigger t2i_guasto before insert or update on users
      for each row execute function t2i_guasto()`);

    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString('utf8'));
        done();
      },
    });
    const traced = await buildApp(
      { ...harness.config, LOG_LEVEL: 'info' },
      { objectStore: fakeObjectStore(), logStream },
    );
    await traced.ready();
    try {
      const tracedHarness = { ...harness, app: traced } as Harness;
      const signed = await signIn(tracedHarness, { email: ADMIN_EMAIL, area: 'impostazioni' });
      const { account } = await createAccount(tracedHarness, signed, 'sano@example.invalid');
      lines.length = 0;

      const creazione = await traced.inject({
        method: 'POST',
        url: '/accounts',
        headers: signed.writeHeaders,
        payload: {
          email: 'guasto.creazione@example.invalid',
          fullName: 'Persona Sintetica',
          roleKeys: ['editor'],
        },
      });
      expect(creazione.statusCode).toBe(500);
      const modifica = await patch(tracedHarness, signed.writeHeaders, account.id, {
        email: 'guasto.modifica@example.invalid',
      });
      expect(modifica.statusCode).toBe(500);

      const log = lines.join('');
      // Il guasto è davvero finito nel log: altrimenti la prova passerebbe a vuoto.
      expect(log).toContain('richiesta fallita');
      expect(log).not.toContain('guasto.creazione');
      expect(log).not.toContain('guasto.modifica');
      // Prima del giro 1 il messaggio portava anche l'hash della password appena generata.
      expect(log).not.toContain('$argon2id');
      expect(log).not.toMatch(/Failed query|insert into/i);
      // Resta ciò che serve per diagnosticare: il codice SQLSTATE del guasto.
      expect(log).toContain('P0001');
      expect(creazione.body).not.toContain('guasto.');
      expect(modifica.body).not.toContain('guasto.');
    } finally {
      await traced.close();
      await harness.db.execute(sql`drop trigger if exists t2i_guasto on users`);
      await harness.db.execute(sql`drop function if exists t2i_guasto()`);
    }
  });
});
