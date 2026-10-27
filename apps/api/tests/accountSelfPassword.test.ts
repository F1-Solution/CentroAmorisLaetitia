import { schema } from '@amoris/db';
import { and, eq, isNull } from 'drizzle-orm';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { identifierDigest } from '../src/auth/loginAttempts.js';
import {
  ADMIN_EMAIL,
  createHarness,
  fakeObjectStore,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W7, T2l (DR-288, D184 = C): sul **proprio** account ogni modifica —
 * nome, email, ruoli, stato — e la reimpostazione della propria password
 * chiedono la password attuale in `currentPassword`. Assente: 400 in italiano;
 * errata: 403 `INVALID_CREDENTIALS` con lo stesso conteggio dei tentativi di
 * `/auth/password` (ADR-007 §3.1 controllo 8) e lo stesso registro del
 * fallimento; nessuna scrittura in caso di rifiuto. Per gli account altrui
 * nulla cambia. La password non compare mai in log, registro o risposte.
 *
 * Ogni caso usa un'amministrazione sintetica propria (`*@example.invalid`), così
 * il conteggio per account di un caso non tocca gli altri; il tetto per
 * indirizzo IP è alzato perché tutte le richieste di prova vengono dallo stesso.
 */

const OWN_PASSWORD = 'password-propria-sintetica-1';
const WRONG_PASSWORD = 'password-sbagliata-sintetica-9';

let harness: Harness;
let admin: Signed;
let sequence = 0;

beforeAll(async () => {
  harness = await createHarness('api_account_self', { LOGIN_MAX_PER_IP: '1000' });
  admin = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

interface Self {
  readonly id: string;
  readonly email: string;
  readonly signed: Signed;
}

/** Un'amministrazione nuova, attivata con la password propria ed entrata in Impostazioni. */
async function newSelf(h: Harness = harness, by: Signed = admin): Promise<Self> {
  sequence += 1;
  const email = `se.stessa.${sequence}@example.invalid`;
  const created = await h.app.inject({
    method: 'POST',
    url: '/accounts',
    headers: by.writeHeaders,
    payload: { email, fullName: 'Persona Sintetica', roleKeys: ['amministrazione'] },
  });
  expect(created.statusCode, created.body).toBe(201);
  const { account, temporaryPassword } = created.json() as {
    account: { id: string };
    temporaryPassword: string;
  };
  const first = await signIn(h, { email, password: temporaryPassword, area: null });
  const change = await h.app.inject({
    method: 'POST',
    url: '/auth/password',
    headers: first.writeHeaders,
    payload: { currentPassword: temporaryPassword, newPassword: OWN_PASSWORD },
  });
  expect(change.statusCode, change.body).toBe(200);
  const signed = await signIn(h, { email, password: OWN_PASSWORD, area: 'impostazioni' });
  return { id: account.id, email, signed };
}

function patch(h: Harness, signed: Signed, id: string, payload: unknown) {
  return h.app.inject({
    method: 'PATCH',
    url: `/accounts/${id}`,
    headers: signed.writeHeaders,
    payload,
  });
}

function reset(h: Harness, signed: Signed, id: string, payload?: unknown) {
  return h.app.inject({
    method: 'POST',
    url: `/accounts/${id}/password-reset`,
    headers: signed.writeHeaders,
    ...(payload === undefined ? {} : { payload }),
  });
}

async function userRow(id: string) {
  const [row] = await harness.db
    .select({
      email: schema.users.email,
      fullName: schema.users.fullName,
      isActive: schema.users.isActive,
      passwordHash: schema.users.passwordHash,
      mustChangePassword: schema.users.mustChangePassword,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id));
  if (!row) throw new Error('account di prova non trovato');
  return row;
}

async function roleKeysOf(id: string): Promise<string[]> {
  const rows = await harness.db
    .select({ key: schema.roles.key })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(eq(schema.userRoles.userId, id));
  return rows.map((row) => row.key).sort();
}

async function liveSessions(id: string): Promise<number> {
  const rows = await harness.db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, id), isNull(schema.sessions.revokedAt)));
  return rows.length;
}

/** Le righe di fallimento che il conteggio del controllo 8 legge, per l'account. */
async function counted(email: string) {
  return harness.db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.action, 'auth.password_changed'),
        eq(schema.auditLog.outcome, 'failure'),
        eq(schema.auditLog.entityId, identifierDigest(email)),
      ),
    );
}

/** Ogni modifica del proprio account che la rotta PATCH ammette, con il controllo del suo effetto. */
const MODIFICATIONS = [
  {
    name: 'nome',
    body: (_self: Self) => ({ fullName: 'Nome Cambiato' }),
    applied: async (self: Self) => (await userRow(self.id)).fullName === 'Nome Cambiato',
  },
  {
    name: 'email',
    body: (self: Self) => ({ email: `nuova.${self.email}` }),
    applied: async (self: Self) => (await userRow(self.id)).email === `nuova.${self.email}`,
  },
  {
    name: 'ruoli',
    body: (_self: Self) => ({ roleKeys: ['editor', 'amministrazione'] }),
    applied: async (self: Self) => (await roleKeysOf(self.id)).includes('editor'),
  },
  {
    name: 'stato',
    body: (_self: Self) => ({ isActive: false }),
    applied: async (self: Self) => !(await userRow(self.id)).isActive,
  },
] as const;

describe('PATCH /accounts/:id sul proprio account (DR-288)', () => {
  it('senza password attuale: 400 in italiano con codice stabile, e nulla cambia', async () => {
    const self = await newSelf();
    for (const modification of MODIFICATIONS) {
      for (const payload of [
        modification.body(self),
        { ...modification.body(self), currentPassword: '' },
      ]) {
        const risposta = await patch(harness, self.signed, self.id, payload);
        expect(risposta.statusCode, modification.name).toBe(400);
        const { error } = risposta.json() as { error: { code: string; message: string } };
        expect(error.code).toBe('CURRENT_PASSWORD_REQUIRED');
        expect(error.message).toBe('Per modificare il proprio account serve la password attuale.');
        expect(await modification.applied(self), modification.name).toBe(false);
      }
    }
    // Una password assente non è un tentativo sbagliato: non entra nel conteggio.
    expect(await counted(self.email)).toHaveLength(0);
  });

  it('la sola password attuale, senza alcuna modifica, resta una richiesta vuota (400)', async () => {
    const self = await newSelf();
    const risposta = await patch(harness, self.signed, self.id, { currentPassword: OWN_PASSWORD });
    expect(risposta.statusCode).toBe(400);
    expect(risposta.json().error.code).toBe('VALIDATION_FAILED');
  });

  for (const modification of MODIFICATIONS) {
    it(`${modification.name} con password errata: 403 come /auth/password, nessuna scrittura, fallimento contato`, async () => {
      const self = await newSelf();
      const before = await userRow(self.id);
      const risposta = await patch(harness, self.signed, self.id, {
        ...modification.body(self),
        currentPassword: WRONG_PASSWORD,
      });
      expect(risposta.statusCode).toBe(403);
      expect(risposta.json().error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Indirizzo o password non corretti.',
      });
      expect(await modification.applied(self)).toBe(false);
      expect(await userRow(self.id)).toEqual(before);
      expect(await roleKeysOf(self.id)).toEqual(['amministrazione']);
      // La sessione resta: il rifiuto non revoca nulla.
      expect(await liveSessions(self.id)).toBeGreaterThan(0);
      // Lo stesso registro del fallimento di /auth/password: è la riga che il conteggio legge.
      const rows = await counted(self.email);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.actorUserId).toBe(self.id);
    });

    it(`${modification.name} con la password giusta: 200 e la modifica è fatta`, async () => {
      const self = await newSelf();
      const risposta = await patch(harness, self.signed, self.id, {
        ...modification.body(self),
        currentPassword: OWN_PASSWORD,
      });
      expect(risposta.statusCode, risposta.body).toBe(200);
      expect(await modification.applied(self)).toBe(true);
      expect(await counted(self.email)).toHaveLength(0);
    });
  }

  it('i fallimenti si sommano a quelli di /auth/password: al tetto 429, anche con la password giusta', async () => {
    const self = await newSelf();
    const max = harness.config.LOGIN_MAX_PER_ACCOUNT;
    // Uno dal cambio password, gli altri dalla modifica: il conteggio è uno solo.
    const cambio = await harness.app.inject({
      method: 'POST',
      url: '/auth/password',
      headers: self.signed.writeHeaders,
      payload: { currentPassword: WRONG_PASSWORD, newPassword: 'password-nuova-sintetica-2' },
    });
    expect(cambio.statusCode).toBe(403);
    for (let tentativo = 1; tentativo < max; tentativo += 1) {
      const errata = await patch(harness, self.signed, self.id, {
        fullName: 'Nome Bloccato',
        currentPassword: WRONG_PASSWORD,
      });
      expect(errata.statusCode).toBe(403);
    }
    expect(await counted(self.email)).toHaveLength(max);

    const bloccata = await patch(harness, self.signed, self.id, {
      fullName: 'Nome Bloccato',
      currentPassword: OWN_PASSWORD,
    });
    expect(bloccata.statusCode).toBe(429);
    expect(bloccata.json().error).toMatchObject({
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Troppi tentativi. Riprovare più tardi.',
    });
    expect((await userRow(self.id)).fullName).toBe('Persona Sintetica');

    // Il blocco vale anche per la reimpostazione e per /auth/password.
    const reimpostazione = await reset(harness, self.signed, self.id, {
      currentPassword: OWN_PASSWORD,
    });
    expect(reimpostazione.statusCode).toBe(429);
    const cambioGiusto = await harness.app.inject({
      method: 'POST',
      url: '/auth/password',
      headers: self.signed.writeHeaders,
      payload: { currentPassword: OWN_PASSWORD, newPassword: 'password-nuova-sintetica-3' },
    });
    expect(cambioGiusto.statusCode).toBe(429);
  });
});

describe('il proprio id scritto in maiuscolo non aggira la regola (rilievo del controller)', () => {
  it('PATCH e reimpostazione con l’id in maiuscolo e senza password: 400, nulla cambia', async () => {
    const self = await newSelf();
    const before = await userRow(self.id);
    const upper = self.id.toUpperCase();
    expect(upper).not.toBe(self.id);

    const modifica = await patch(harness, self.signed, upper, { fullName: 'Nome Aggirato' });
    expect(modifica.statusCode, modifica.body).toBe(400);
    expect(modifica.json().error.code).toBe('CURRENT_PASSWORD_REQUIRED');

    const reimpostazione = await reset(harness, self.signed, upper);
    expect(reimpostazione.statusCode, reimpostazione.body).toBe(400);
    expect(reimpostazione.json().error.code).toBe('CURRENT_PASSWORD_REQUIRED');

    expect(await userRow(self.id)).toEqual(before);
    expect(await liveSessions(self.id)).toBeGreaterThan(0);
  });
});

describe('POST /accounts/:id/password-reset sul proprio account (DR-288)', () => {
  it('senza password attuale: 400, con password errata: 403 contato, e la password non cambia', async () => {
    const self = await newSelf();
    const before = await userRow(self.id);

    for (const payload of [undefined, {}, { currentPassword: '' }]) {
      const assente = await reset(harness, self.signed, self.id, payload);
      expect(assente.statusCode, JSON.stringify(payload)).toBe(400);
      expect(assente.json().error.code).toBe('CURRENT_PASSWORD_REQUIRED');
    }

    const errata = await reset(harness, self.signed, self.id, { currentPassword: WRONG_PASSWORD });
    expect(errata.statusCode).toBe(403);
    expect(errata.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(errata.body).not.toContain('temporaryPassword');

    expect(await userRow(self.id)).toEqual(before);
    expect(await liveSessions(self.id)).toBeGreaterThan(0);
    expect(await counted(self.email)).toHaveLength(1);
  });

  it('con la password giusta: 200, password temporanea, cambio imposto e sessioni chiuse', async () => {
    const self = await newSelf();
    const risposta = await reset(harness, self.signed, self.id, { currentPassword: OWN_PASSWORD });
    expect(risposta.statusCode, risposta.body).toBe(200);
    const { temporaryPassword } = risposta.json() as { temporaryPassword: string };
    expect(temporaryPassword.length).toBeGreaterThan(0);
    expect((await userRow(self.id)).mustChangePassword).toBe(true);
    expect(await liveSessions(self.id)).toBe(0);
  });
});

describe('gli account altrui non cambiano (DR-288)', () => {
  it('modifica e reimpostazione senza password attuale, e quella inviata si ignora', async () => {
    const other = await newSelf();
    const otherAdmin = await newSelf();

    const senza = await patch(harness, otherAdmin.signed, other.id, { fullName: 'Altro Nome' });
    expect(senza.statusCode, senza.body).toBe(200);
    const ignorata = await patch(harness, otherAdmin.signed, other.id, {
      fullName: 'Altro Nome Ancora',
      currentPassword: WRONG_PASSWORD,
    });
    expect(ignorata.statusCode, ignorata.body).toBe(200);
    expect((await userRow(other.id)).fullName).toBe('Altro Nome Ancora');

    const reimpostata = await reset(harness, otherAdmin.signed, other.id);
    expect(reimpostata.statusCode, reimpostata.body).toBe(200);
    const reimpostataConCampo = await reset(harness, otherAdmin.signed, other.id, {
      currentPassword: WRONG_PASSWORD,
    });
    expect(reimpostataConCampo.statusCode, reimpostataConCampo.body).toBe(200);

    // Nessun tentativo contato, né per chi agisce né per chi riceve.
    expect(await counted(otherAdmin.email)).toHaveLength(0);
    expect(await counted(other.email)).toHaveLength(0);
  });

  it('la regola segue l’account della sessione, non il ruolo: l’amministrazione del seme sull’altro account', async () => {
    const other = await newSelf();
    const risposta = await patch(harness, admin, other.id, { isActive: false });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect((await userRow(other.id)).isActive).toBe(false);
    // La password del seme non c'entra: nessun fallimento a suo nome.
    expect(await counted(ADMIN_EMAIL)).toHaveLength(0);
  });
});

describe('la password non va in log, registro o risposte (DR-288)', () => {
  it('nemmeno a livello trace, né quella errata né quella giusta', async () => {
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
      const tracedAdmin = await signIn(tracedHarness, { email: ADMIN_EMAIL, area: 'impostazioni' });
      const self = await newSelf(tracedHarness, tracedAdmin);
      lines.length = 0;

      const responses = [
        await patch(tracedHarness, self.signed, self.id, { fullName: 'Nome Tracciato' }),
        await patch(tracedHarness, self.signed, self.id, {
          fullName: 'Nome Tracciato',
          currentPassword: WRONG_PASSWORD,
        }),
        // Un corpo non valido: il dettaglio dell'errore non deve riportare la password.
        await patch(tracedHarness, self.signed, self.id, {
          email: 'non-un-indirizzo',
          currentPassword: OWN_PASSWORD,
        }),
        await reset(tracedHarness, self.signed, self.id, { currentPassword: WRONG_PASSWORD }),
        await patch(tracedHarness, self.signed, self.id, {
          fullName: 'Nome Tracciato',
          currentPassword: OWN_PASSWORD,
        }),
      ];
      expect(responses.map((risposta) => risposta.statusCode)).toEqual([400, 403, 400, 403, 200]);

      const log = lines.join('');
      // Il logger ha davvero scritto: altrimenti la prova passerebbe a vuoto.
      expect(log).toContain('/accounts/');
      for (const secret of [OWN_PASSWORD, WRONG_PASSWORD]) {
        expect(log).not.toContain(secret);
        for (const risposta of responses) expect(risposta.body).not.toContain(secret);
      }

      const registro = JSON.stringify(
        await harness.db.select().from(schema.auditLog),
        (_key, value) => (typeof value === 'bigint' ? value.toString() : (value as unknown)),
      );
      expect(registro).not.toContain(OWN_PASSWORD);
      expect(registro).not.toContain(WRONG_PASSWORD);
      expect(registro).not.toContain('currentPassword');
    } finally {
      await traced.close();
    }
  });
});
