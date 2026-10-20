import { schema } from '@amoris/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Writable } from 'node:stream';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  ADMIN_EMAIL,
  BOTH_EMAIL,
  createHarness,
  fakeObjectStore,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W1, T3: rotte `/accounts` dell'area Impostazioni (`context.md` §5) e i
 * cinque casi di attenzione del §6. Solo dati sintetici `*@esempio.invalid`.
 */

const NEW_PASSWORD = 'password-definitiva-sintetica';
const UNAMBIGUOUS = /^[A-HJ-NP-Za-km-z2-9]+$/;

let harness: Harness;
let admin: Signed;

beforeAll(async () => {
  harness = await createHarness('api_accounts');
  admin = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

interface AccountBody {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roleKeys: string[];
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

/** Primo accesso con la password temporanea, cambio obbligatorio, poi ingresso nell'area. */
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

function patch(h: Harness, signed: Signed, id: string, payload: Record<string, unknown>) {
  return h.app.inject({
    method: 'PATCH',
    url: `/accounts/${id}`,
    headers: signed.writeHeaders,
    payload,
  });
}

async function auditRow(action: string, entityId: string) {
  const [row] = await harness.db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.action, action), eq(schema.auditLog.entityId, entityId)));
  return row;
}

async function userByEmail(h: Harness, email: string) {
  const [row] = await h.db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!row) throw new Error('persona non trovata');
  return row;
}

/** Attende che una richiesta resti in coda sul blocco consultivo degli account. */
async function waitForBlockedLock(h: Harness): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await h.db.execute<{ waiting: number }>(
      sql`select count(*)::int as waiting from pg_locks where locktype = 'advisory' and not granted`,
    );
    if ((rows[0]?.waiting ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('la richiesta non si è messa in attesa del blocco');
}

describe('GET /accounts', () => {
  it('elenca gli account con i ruoli e senza hash della password', async () => {
    const risposta = await harness.app.inject({
      method: 'GET',
      url: '/accounts',
      headers: { cookie: admin.cookie },
    });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.body).not.toMatch(/passwordHash|argon2/i);
    const { items } = risposta.json() as { items: AccountBody[] };
    const both = items.find((item) => item.email === BOTH_EMAIL);
    expect(both?.roleKeys.sort()).toEqual(['amministrazione', 'editor']);
    expect(Object.keys(items[0] ?? {}).sort()).toEqual(
      ['createdAt', 'email', 'fullName', 'id', 'isActive', 'lastLoginAt', 'roleKeys'].sort(),
    );
  });
});

describe('POST /accounts', () => {
  it('crea l’account con una password temporanea casuale di almeno 16 caratteri', async () => {
    const one = await createAccount(harness, admin, 'nuova.uno@esempio.invalid');
    const two = await createAccount(harness, admin, 'nuova.due@esempio.invalid');
    expect(one.temporaryPassword.length).toBeGreaterThanOrEqual(16);
    expect(one.temporaryPassword).toMatch(UNAMBIGUOUS);
    expect(one.temporaryPassword).not.toBe(two.temporaryPassword);
    expect(one.account.roleKeys).toEqual(['editor']);
    expect(one.account.isActive).toBe(true);

    const row = await userByEmail(harness, 'nuova.uno@esempio.invalid');
    expect(row.mustChangePassword).toBe(true);
    expect(row.passwordHash).not.toContain(one.temporaryPassword);

    // Con la password temporanea si entra, ma il cambio è richiesto.
    const login = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nuova.uno@esempio.invalid', password: one.temporaryPassword },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().mustChangePassword).toBe(true);
  });

  it('caso 4: maiuscole e spazi sono lo stesso indirizzo, e il doppione è 409', async () => {
    const created = await createAccount(harness, admin, '  Persona@Esempio.invalid ');
    expect(created.account.email).toBe('persona@esempio.invalid');
    const doppione = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: admin.writeHeaders,
      payload: { email: 'persona@esempio.invalid', fullName: 'Altra', roleKeys: ['editor'] },
    });
    expect(doppione.statusCode).toBe(409);
    expect(doppione.json().error.message).toMatch(/indirizzo/i);
  });

  it('rifiuta con 400 un corpo senza ruoli o con un ruolo non assegnabile', async () => {
    for (const roleKeys of [[], ['segreteria']]) {
      const risposta = await harness.app.inject({
        method: 'POST',
        url: '/accounts',
        headers: admin.writeHeaders,
        payload: { email: 'non.valida@esempio.invalid', fullName: 'X', roleKeys },
      });
      expect(risposta.statusCode, JSON.stringify(roleKeys)).toBe(400);
    }
  });
});

describe('PATCH /accounts/:id', () => {
  it('modifica il nome e lo registra come account.update', async () => {
    const { account } = await createAccount(harness, admin, 'nome@esempio.invalid');
    const risposta = await patch(harness, admin, account.id, { fullName: 'Nome Cambiato' });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().account.fullName).toBe('Nome Cambiato');
    expect(await auditRow('account.update', account.id)).toBeDefined();
  });

  it('caso 2: la disattivazione chiude subito la sessione aperta della persona (401)', async () => {
    const created = await createAccount(harness, admin, 'disattivata@esempio.invalid');
    const persona = await activate(
      harness,
      'disattivata@esempio.invalid',
      created.temporaryPassword,
      'redazione',
    );
    const prima = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: persona.cookie },
    });
    expect(prima.statusCode).toBe(200);

    const risposta = await patch(harness, admin, created.account.id, { isActive: false });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().account.isActive).toBe(false);

    const dopo = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: persona.cookie },
    });
    expect(dopo.statusCode).toBe(401);
    const sessioniVive = await harness.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, created.account.id));
    expect(sessioniVive.every((s) => s.revokedAt !== null)).toBe(true);
    expect(await auditRow('account.deactivate', created.account.id)).toBeDefined();
  });

  it('la riattivazione rimette in grado di entrare', async () => {
    const created = await createAccount(harness, admin, 'riattivata@esempio.invalid');
    await patch(harness, admin, created.account.id, { isActive: false });
    const risposta = await patch(harness, admin, created.account.id, { isActive: true });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().account.isActive).toBe(true);
    const login = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'riattivata@esempio.invalid', password: created.temporaryPassword },
    });
    expect(login.statusCode).toBe(200);
    expect(await auditRow('account.reactivate', created.account.id)).toBeDefined();
  });

  it('cambia i ruoli e registra account.roles con le sole chiavi', async () => {
    const { account } = await createAccount(harness, admin, 'ruoli@esempio.invalid');
    const risposta = await patch(harness, admin, account.id, {
      roleKeys: ['editor', 'amministrazione'],
    });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().account.roleKeys.sort()).toEqual(['amministrazione', 'editor']);
    const row = await auditRow('account.roles', account.id);
    expect(row?.detail).toMatchObject({
      accountId: account.id,
      roleKeys: ['amministrazione', 'editor'],
    });
  });

  it('caso 3: tolta l’amministrazione durante la sessione, la richiesta dopo è rifiutata', async () => {
    const created = await createAccount(harness, admin, 'revocata@esempio.invalid', [
      'editor',
      'amministrazione',
    ]);
    const persona = await activate(
      harness,
      'revocata@esempio.invalid',
      created.temporaryPassword,
      'impostazioni',
    );
    const prima = await harness.app.inject({
      method: 'GET',
      url: '/accounts',
      headers: { cookie: persona.cookie },
    });
    expect(prima.statusCode).toBe(200);

    const risposta = await patch(harness, admin, created.account.id, { roleKeys: ['editor'] });
    expect(risposta.statusCode).toBe(200);

    const dopo = await harness.app.inject({
      method: 'GET',
      url: '/accounts',
      headers: { cookie: persona.cookie },
    });
    // Scelta di attuazione: togliere un ruolo revoca le sessioni della persona.
    expect(dopo.statusCode).toBe(401);

    // Al nuovo accesso il commutatore non offre più Impostazioni.
    const login = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'revocata@esempio.invalid', password: NEW_PASSWORD },
    });
    const areas = (login.json().rolesHeld as { areas: string[] }[]).flatMap((r) => r.areas);
    expect(areas).not.toContain('impostazioni');
  });

  it('togliere un ruolo revoca, nella stessa operazione, ogni sessione della persona', async () => {
    const created = await createAccount(harness, admin, 'sessioni.ruolo@esempio.invalid', [
      'editor',
      'amministrazione',
    ]);
    const email = 'sessioni.ruolo@esempio.invalid';
    await activate(harness, email, created.temporaryPassword, 'impostazioni');
    await signIn(harness, { email, password: NEW_PASSWORD, area: 'redazione' });
    const vive = await harness.db
      .select()
      .from(schema.sessions)
      .where(
        and(eq(schema.sessions.userId, created.account.id), isNull(schema.sessions.revokedAt)),
      );
    expect(vive.length).toBeGreaterThanOrEqual(2);

    const risposta = await patch(harness, admin, created.account.id, { roleKeys: ['editor'] });
    expect(risposta.statusCode).toBe(200);
    const sessioni = await harness.db
      .select({ revokedAt: schema.sessions.revokedAt })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, created.account.id));
    expect(sessioni.length).toBeGreaterThanOrEqual(2);
    expect(sessioni.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it('S8: cambiare i ruoli assegnabili lascia intatti gli altri ruoli della persona', async () => {
    const [segreteria] = await harness.db
      .insert(schema.roles)
      .values({ key: 'segreteria', label: 'Segreteria', isSystem: false })
      .returning({ id: schema.roles.id });
    if (!segreteria) throw new Error('ruolo di prova non creato');
    const { account } = await createAccount(harness, admin, 'estraneo@esempio.invalid', ['editor']);
    await harness.db.insert(schema.userRoles).values({ userId: account.id, roleId: segreteria.id });

    const risposta = await patch(harness, admin, account.id, { roleKeys: ['amministrazione'] });
    expect(risposta.statusCode).toBe(200);
    expect(risposta.json().account.roleKeys).toEqual(['amministrazione', 'segreteria']);
  });

  it('risponde 404 per un account inesistente e 400 per un corpo vuoto', async () => {
    const inesistente = await patch(harness, admin, crypto.randomUUID(), { fullName: 'X' });
    expect(inesistente.statusCode).toBe(404);
    const { account } = await createAccount(harness, admin, 'vuoto@esempio.invalid');
    const vuoto = await patch(harness, admin, account.id, {});
    expect(vuoto.statusCode).toBe(400);
  });
});

describe('POST /accounts/:id/password-reset', () => {
  it('genera una password nuova, impone il cambio e chiude le sessioni', async () => {
    const created = await createAccount(harness, admin, 'reimpostata@esempio.invalid');
    const persona = await activate(
      harness,
      'reimpostata@esempio.invalid',
      created.temporaryPassword,
      'redazione',
    );

    const risposta = await harness.app.inject({
      method: 'POST',
      url: `/accounts/${created.account.id}/password-reset`,
      headers: admin.writeHeaders,
    });
    expect(risposta.statusCode).toBe(200);
    const { temporaryPassword } = risposta.json() as { temporaryPassword: string };
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(16);

    const row = await userByEmail(harness, 'reimpostata@esempio.invalid');
    expect(row.mustChangePassword).toBe(true);
    const dopo = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: persona.cookie },
    });
    expect(dopo.statusCode).toBe(401);

    const vecchia = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'reimpostata@esempio.invalid', password: NEW_PASSWORD },
    });
    expect(vecchia.statusCode).toBe(401);
    const nuova = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'reimpostata@esempio.invalid', password: temporaryPassword },
    });
    expect(nuova.statusCode).toBe(200);
    expect(await auditRow('account.password_reset', created.account.id)).toBeDefined();
  });

  it('risponde 404 per un account inesistente', async () => {
    const risposta = await harness.app.inject({
      method: 'POST',
      url: `/accounts/${crypto.randomUUID()}/password-reset`,
      headers: admin.writeHeaders,
    });
    expect(risposta.statusCode).toBe(404);
  });
});

describe('la redazione non entra', () => {
  const routes = (id: string) => [
    { method: 'GET' as const, url: '/accounts', payload: undefined },
    {
      method: 'POST' as const,
      url: '/accounts',
      payload: { email: 'mai@esempio.invalid', fullName: 'Mai', roleKeys: ['editor'] },
    },
    { method: 'PATCH' as const, url: `/accounts/${id}`, payload: { fullName: 'Mai' } },
    { method: 'POST' as const, url: `/accounts/${id}/password-reset`, payload: undefined },
  ];

  it('il solo ruolo di redazione riceve 403 su ogni rotta', async () => {
    const redazione = await signIn(harness);
    for (const route of routes(harness.userId)) {
      const risposta = await harness.app.inject({ ...route, headers: redazione.writeHeaders });
      expect(risposta.statusCode, `${route.method} ${route.url}`).toBe(403);
    }
  });

  it('S13: il 403 per area sbagliata ferma davvero il gestore, niente scritture né autopromozione', async () => {
    const redazione = await signIn(harness);
    const creazione = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: redazione.writeHeaders,
      payload: {
        email: 'intruso@esempio.invalid',
        fullName: 'Intruso',
        roleKeys: ['amministrazione'],
      },
    });
    const promozione = await patch(harness, redazione, harness.userId, {
      roleKeys: ['editor', 'amministrazione'],
    });
    expect(creazione.statusCode).toBe(403);
    expect(promozione.statusCode).toBe(403);
    const intrusi = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'intruso@esempio.invalid'));
    expect(intrusi).toHaveLength(0);
    const ruoli = await harness.db
      .select({ key: schema.roles.key })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(eq(schema.userRoles.userId, harness.userId));
    expect(ruoli.map((r) => r.key)).toEqual(['editor']);
  });

  it('S13: nessun rifiuto del controllo di accesso lascia partire il gestore', async () => {
    const probe = await buildApp(harness.config, { objectStore: fakeObjectStore() });
    const reached = { permission: false, session: false, missing: false };
    // Il gestore alza il flag alla prima riga: se parte, dopo `inject` il flag è vero.
    const addRoute = (
      area: 'impostazioni' | 'redazione',
      url: string,
      flag: keyof typeof reached,
      preHandler: Parameters<typeof probe.route>[0]['preHandler'],
    ) =>
      probe.register(async (scoped) => {
        scoped.route({
          method: ['GET', 'POST'],
          url,
          config: { area },
          preHandler,
          handler: () => {
            reached[flag] = true;
            return { ok: true };
          },
        });
      });
    await addRoute(
      'impostazioni',
      '/__s13/permission',
      'permission',
      probe.requirePermission('users.manage'),
    );
    await addRoute('impostazioni', '/__s13/session', 'session', probe.requireSession);
    // Area giusta ma permesso mancante: la redazione non ha `users.manage`.
    await addRoute(
      'redazione',
      '/__s13/missing',
      'missing',
      probe.requirePermission('users.manage'),
    );
    await probe.ready();
    try {
      const redazione = await signIn(harness);
      for (const url of ['/__s13/permission', '/__s13/session']) {
        // Area sbagliata, in scrittura (con token anti-CSRF valido).
        const scrittura = await probe.inject({
          method: 'POST',
          url,
          headers: redazione.writeHeaders,
          payload: {},
        });
        expect(scrittura.statusCode, `area sbagliata ${url}`).toBe(403);
        // Nessuna sessione: 401.
        const anonima = await probe.inject({ method: 'GET', url });
        expect(anonima.statusCode, `nessuna sessione ${url}`).toBe(401);
      }

      const senzaPermesso = await probe.inject({
        method: 'POST',
        url: '/__s13/missing',
        headers: redazione.writeHeaders,
        payload: {},
      });
      expect(senzaPermesso.statusCode).toBe(403);

      // Cambio password in sospeso: area giusta ma rifiuto per difetto.
      await harness.db
        .update(schema.users)
        .set({ mustChangePassword: true })
        .where(eq(schema.users.id, harness.userId));
      const inSospeso = await probe.inject({
        method: 'POST',
        url: '/__s13/missing',
        headers: redazione.writeHeaders,
        payload: {},
      });
      await harness.db
        .update(schema.users)
        .set({ mustChangePassword: false })
        .where(eq(schema.users.id, harness.userId));
      expect(inSospeso.statusCode).toBe(403);

      expect(reached).toEqual({ permission: false, session: false, missing: false });
    } finally {
      await probe.close();
    }
  });

  it('chi ha entrambi i ruoli ma lavora in Redazione riceve 403 su ogni rotta', async () => {
    const inRedazione = await signIn(harness, { email: BOTH_EMAIL, area: 'redazione' });
    for (const route of routes(harness.userId)) {
      const risposta = await harness.app.inject({ ...route, headers: inRedazione.writeHeaders });
      expect(risposta.statusCode, `${route.method} ${route.url}`).toBe(403);
    }
  });
});

describe('registro delle operazioni', () => {
  it('ogni riga degli account porta l’id toccato, mai indirizzi o password', async () => {
    const created = await createAccount(harness, admin, 'registro@esempio.invalid');
    const reset = await harness.app.inject({
      method: 'POST',
      url: `/accounts/${created.account.id}/password-reset`,
      headers: admin.writeHeaders,
    });
    const secondPassword = (reset.json() as { temporaryPassword: string }).temporaryPassword;

    const creazione = await auditRow('account.create', created.account.id);
    // S5: la concessione dei ruoli alla creazione si ricostruisce dal registro.
    expect(creazione?.detail).toMatchObject({
      accountId: created.account.id,
      roleKeys: ['editor'],
    });

    const rows = await harness.db.select().from(schema.auditLog);
    const accountRows = rows.filter((row) => row.action.startsWith('account.'));
    expect(accountRows.length).toBeGreaterThan(0);
    for (const row of accountRows) {
      const detail = JSON.stringify(row.detail);
      expect(detail).not.toContain('@');
      expect(detail).not.toContain(created.temporaryPassword);
      expect(detail).not.toContain(secondPassword);
    }
    const everything = JSON.stringify(rows.map((row) => row.detail));
    expect(everything).not.toContain(created.temporaryPassword);
    expect(everything).not.toContain(secondPassword);
  });
});

describe('caso 5: password temporanea nei log', () => {
  it('la password restituita non compare nei log catturati, nemmeno a livello trace', async () => {
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
      const created = await createAccount(tracedHarness, signed, 'log@esempio.invalid');
      const reset = await traced.inject({
        method: 'POST',
        url: `/accounts/${created.account.id}/password-reset`,
        headers: signed.writeHeaders,
      });
      const secondPassword = (reset.json() as { temporaryPassword: string }).temporaryPassword;

      const log = lines.join('');
      // Il logger ha davvero scritto: altrimenti la prova passerebbe a vuoto.
      expect(log).toContain('/accounts');
      expect(log).not.toContain(created.temporaryPassword);
      expect(log).not.toContain(secondPassword);
      expect(log).not.toContain('log@esempio.invalid');
    } finally {
      await traced.close();
    }
  });
});

describe('caso 1: non si resta senza amministrazione', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness('api_accounts_last');
  }, 120_000);

  afterAll(async () => {
    await h?.teardown();
  });

  it('due disattivazioni concorrenti: la seconda attende la prima e risponde 409', async () => {
    const a = await signIn(h, { email: ADMIN_EMAIL, area: 'impostazioni' });
    const adminId = (await userByEmail(h, ADMIN_EMAIL)).id;
    const bothId = (await userByEmail(h, BOTH_EMAIL)).id;

    // Una transazione concorrente tiene il blocco e disattiva l'altra amministrazione:
    // senza blocco la richiesta vedrebbe ancora attiva quella persona e passerebbe.
    const raw = postgres(h.config.DATABASE_URL, { max: 1, onnotice: () => {} });
    let pending: ReturnType<typeof patch> | undefined;
    try {
      await raw.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext('accounts.administration'))`;
        pending = patch(h, a, adminId, { isActive: false });
        await waitForBlockedLock(h);
        await tx`update users set is_active = false where id = ${bothId}`;
      });
    } finally {
      await raw.end({ timeout: 5 });
    }
    const risposta = await pending;
    expect(risposta?.statusCode, risposta?.body).toBe(409);
    expect((await userByEmail(h, ADMIN_EMAIL)).isActive).toBe(true);
  });

  it('l’ultima amministrazione non toglie a sé il ruolo né si disattiva (409, in italiano)', async () => {
    const adminRow = await userByEmail(h, ADMIN_EMAIL);
    const bothRow = await userByEmail(h, BOTH_EMAIL);
    const survivor = adminRow.isActive ? adminRow : bothRow;
    const signed = await signIn(h, { email: survivor.email, area: 'impostazioni' });

    const togli = await patch(h, signed, survivor.id, { roleKeys: ['editor'] });
    expect(togli.statusCode).toBe(409);
    expect(togli.json().error.message).toMatch(/amministrazione/i);

    const disattiva = await patch(h, signed, survivor.id, { isActive: false });
    expect(disattiva.statusCode).toBe(409);
    expect(disattiva.json().error.message).toMatch(/amministrazione/i);

    // Il 409 annulla anche la revoca: la sessione dell'ultima amministrazione resta valida.
    const ancora = await h.app.inject({
      method: 'GET',
      url: '/accounts',
      headers: { cookie: signed.cookie },
    });
    expect(ancora.statusCode).toBe(200);

    const [still] = await h.db
      .select({ isActive: schema.users.isActive })
      .from(schema.users)
      .where(eq(schema.users.id, survivor.id));
    expect(still?.isActive).toBe(true);
  });
});

describe('S4: nessuna risposta degli account resta in cache', () => {
  it('elenco, creazione, modifica e reimpostazione rispondono Cache-Control: no-store', async () => {
    const elenco = await harness.app.inject({
      method: 'GET',
      url: '/accounts',
      headers: { cookie: admin.cookie },
    });
    const creazione = await harness.app.inject({
      method: 'POST',
      url: '/accounts',
      headers: admin.writeHeaders,
      payload: {
        email: 'cache@esempio.invalid',
        fullName: 'Persona Sintetica',
        roleKeys: ['editor'],
      },
    });
    const id = (creazione.json() as { account: AccountBody }).account.id;
    const modifica = await patch(harness, admin, id, { fullName: 'Persona Rinominata' });
    const reset = await harness.app.inject({
      method: 'POST',
      url: `/accounts/${id}/password-reset`,
      headers: admin.writeHeaders,
    });
    for (const risposta of [elenco, creazione, modifica, reset]) {
      expect(risposta.statusCode).toBeLessThan(300);
      expect(risposta.headers['cache-control']).toBe('no-store');
    }
  });
});
