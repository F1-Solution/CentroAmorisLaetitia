import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertLocalDatabase,
  createLocalAccount,
  LocalAccountError,
  parseLocalAccountInput,
  parseServerAccountInput,
  assertAccountIdentityNotInEnv,
  parseServerEmailInput,
  readServerInput,
  readTargetEmail,
  resolveAccountMode,
} from '../src/accounts/localAccount.js';
import { TEMPORARY_PASSWORD_LENGTH, verifyPassword } from '../src/lib/password.js';
import { createHarness, type Harness } from './_support/harness.js';

/**
 * Lo strumento che crea un account locale sul database importato. Dati
 * sintetici: indirizzi `.invalid`, password inventate per la prova.
 */

const PASSWORD = 'password-sintetica-lunga';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness('api_account_locale');
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

describe('createLocalAccount', () => {
  it('crea l’account con una password verificabile e il ruolo esistente', async () => {
    const result = await createLocalAccount(harness.db, harness.config, {
      email: 'amministrazione@esempio.invalid',
      fullName: 'Amministrazione locale',
      password: PASSWORD,
      roleKey: 'editor',
    });

    const [user] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, result.userId));
    expect(user!.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(user!.passwordHash!, PASSWORD)).toBe(true);
    expect(user!.isActive).toBe(true);

    const roles = await harness.db
      .select({ key: schema.roles.key })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(eq(schema.userRoles.userId, result.userId));
    expect(roles.map((r) => r.key)).toEqual(['editor']);
  });

  it('accetta il ruolo di amministrazione, seminato dalla migrazione (DR-227)', async () => {
    const result = await createLocalAccount(harness.db, harness.config, {
      email: 'persone@esempio.invalid',
      fullName: 'Persone locali',
      password: PASSWORD,
      roleKey: 'amministrazione',
    });
    const roles = await harness.db
      .select({ key: schema.roles.key })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(eq(schema.userRoles.userId, result.userId));
    expect(roles.map((r) => r.key)).toEqual(['amministrazione']);
    expect(
      parseLocalAccountInput({
        ACCOUNT_EMAIL: 'x@esempio.invalid',
        ACCOUNT_NAME: 'X',
        ACCOUNT_PASSWORD: PASSWORD,
        ACCOUNT_ROLE: 'amministrazione',
      }).roleKey,
    ).toBe('amministrazione');
  });

  it('non sovrascrive un account con lo stesso indirizzo', async () => {
    await expect(
      createLocalAccount(harness.db, harness.config, {
        email: 'amministrazione@esempio.invalid',
        fullName: 'Altro nome',
        password: 'un-altra-password-lunga',
        roleKey: 'editor',
      }),
    ).rejects.toBeInstanceOf(LocalAccountError);
  });

  it('non crea ruoli: un ruolo inesistente è un errore, e nessun account nasce', async () => {
    await expect(
      createLocalAccount(harness.db, harness.config, {
        email: 'ruolo-inesistente@esempio.invalid',
        fullName: 'Ruolo inesistente',
        password: PASSWORD,
        roleKey: 'administrator',
      }),
    ).rejects.toBeInstanceOf(LocalAccountError);
    const rows = await harness.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, 'ruolo-inesistente@esempio.invalid'));
    expect(rows).toHaveLength(0);
  });
});

describe('createLocalAccount e registro delle operazioni (DR-421)', () => {
  const auditRows = (where: ReturnType<typeof eq>) =>
    harness.db.select().from(schema.auditLog).where(where);

  it('scrive una sola riga account.create con origine cli, ruolo, nessun attore e nessun dato personale', async () => {
    const email = 'registro-cli@esempio.invalid';
    const fullName = 'Persona registro sintetica';
    const result = await createLocalAccount(harness.db, harness.config, {
      email,
      fullName,
      password: PASSWORD,
      roleKey: 'editor',
    });

    const rows = await auditRows(eq(schema.auditLog.entityId, result.userId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.action).toBe('account.create');
    expect(row.entityType).toBe('account');
    expect(row.outcome).toBe('success');
    expect(row.actorUserId).toBeNull();
    expect(row.ipHash).toBeNull();
    expect(row.sessionId).toBeNull();
    expect(row.detail).toEqual({ source: 'cli', roleKey: 'editor' });
    const serialised = JSON.stringify(row, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    for (const secret of [email, fullName, PASSWORD]) expect(serialised).not.toContain(secret);
  });

  it('con la password temporanea il registro non la contiene', async () => {
    const result = await createLocalAccount(harness.db, harness.config, {
      email: 'registro-temporanea@esempio.invalid',
      fullName: 'Persona registro temporanea',
      roleKey: 'editor',
    });
    const rows = await auditRows(eq(schema.auditLog.entityId, result.userId));
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0]!.detail)).not.toContain(result.temporaryPassword!);
  });

  it('se la creazione fallisce (ruolo assente o indirizzo già usato) non resta alcuna riga', async () => {
    const before = await auditRows(eq(schema.auditLog.action, 'account.create'));
    await expect(
      createLocalAccount(harness.db, harness.config, {
        email: 'registro-ruolo@esempio.invalid',
        fullName: 'Ruolo assente',
        password: PASSWORD,
        roleKey: 'administrator',
      }),
    ).rejects.toBeInstanceOf(LocalAccountError);
    await expect(
      createLocalAccount(harness.db, harness.config, {
        email: 'amministrazione@esempio.invalid',
        fullName: 'Doppione',
        password: PASSWORD,
        roleKey: 'editor',
      }),
    ).rejects.toBeInstanceOf(LocalAccountError);
    const after = await auditRows(eq(schema.auditLog.action, 'account.create'));
    expect(after).toHaveLength(before.length);
  });
});

describe('parseLocalAccountInput', () => {
  it('rifiuta una password corta senza riportarla nel messaggio', () => {
    const corta = 'corta-1';
    try {
      parseLocalAccountInput({
        ACCOUNT_EMAIL: 'x@esempio.invalid',
        ACCOUNT_NAME: 'X',
        ACCOUNT_PASSWORD: corta,
        ACCOUNT_ROLE: 'editor',
      });
      expect.unreachable('doveva rifiutare');
    } catch (error) {
      expect(error).toBeInstanceOf(LocalAccountError);
      expect((error as Error).message).not.toContain(corta);
      expect((error as Error).message).toContain('ACCOUNT_PASSWORD');
    }
  });

  it('legge i quattro valori dalle variabili d’ambiente', () => {
    expect(
      parseLocalAccountInput({
        ACCOUNT_EMAIL: 'x@esempio.invalid',
        ACCOUNT_NAME: ' Persona ',
        ACCOUNT_PASSWORD: PASSWORD,
        ACCOUNT_ROLE: 'editor',
      }),
    ).toEqual({
      email: 'x@esempio.invalid',
      fullName: 'Persona',
      password: PASSWORD,
      roleKey: 'editor',
    });
  });
});

describe('parseServerAccountInput (indirizzo e nome da stdin, DR-426)', () => {
  const ROLE = { ACCOUNT_ROLE: 'amministrazione' };

  it('legge indirizzo e nome da due righe, con LF o CRLF e spazi ai bordi, e il ruolo dall’ambiente', () => {
    const expected = {
      email: 'x@esempio.invalid',
      fullName: 'Persona Sintetica',
      password: undefined,
      roleKey: 'amministrazione',
    };
    expect(parseServerAccountInput('x@esempio.invalid\nPersona Sintetica\n', ROLE)).toEqual(
      expected,
    );
    expect(
      parseServerAccountInput('  x@esempio.invalid \r\n Persona Sintetica  \r\n', ROLE),
    ).toEqual(expected);
    expect(parseServerAccountInput('x@esempio.invalid\nPersona Sintetica', ROLE)).toEqual(expected);
    expect(parseServerAccountInput('x@esempio.invalid\nPersona Sintetica\n\n\n', ROLE)).toEqual(
      expected,
    );
  });

  it('rifiuta ACCOUNT_EMAIL e ACCOUNT_NAME nell’ambiente, indica stdin e non riporta i valori', () => {
    for (const extra of [
      { ACCOUNT_EMAIL: 'in-ambiente@esempio.invalid' },
      { ACCOUNT_NAME: 'Nome In Ambiente' },
    ]) {
      try {
        parseServerAccountInput('x@esempio.invalid\nPersona\n', { ...ROLE, ...extra });
        expect.unreachable('doveva rifiutare');
      } catch (error) {
        expect(error).toBeInstanceOf(LocalAccountError);
        const message = (error as Error).message;
        expect(message).toContain('stdin');
        expect(message).not.toContain('in-ambiente@esempio.invalid');
        expect(message).not.toContain('Nome In Ambiente');
      }
    }
  });

  it('rifiuta stdin vuoto, una riga sola e righe in più non vuote, senza riportare i valori', () => {
    for (const text of [
      '',
      '\n\n',
      'solo@esempio.invalid\n',
      'x@esempio.invalid\nPersona\nterza-riga-sintetica\n',
      'x@esempio.invalid\n\nPersona\n',
    ]) {
      try {
        parseServerAccountInput(text, ROLE);
        expect.unreachable(`doveva rifiutare: ${JSON.stringify(text)}`);
      } catch (error) {
        expect(error).toBeInstanceOf(LocalAccountError);
        expect((error as Error).message).not.toContain('esempio.invalid');
        expect((error as Error).message).not.toContain('terza-riga-sintetica');
      }
    }
  });

  it('applica la validazione di sempre: indirizzo non valido e ruolo assente', () => {
    expect(() => parseServerAccountInput('non-un-indirizzo\nPersona\n', ROLE)).toThrow(
      LocalAccountError,
    );
    expect(() => parseServerAccountInput('x@esempio.invalid\nPersona\n', {})).toThrow(
      LocalAccountError,
    );
    expect(() => parseServerAccountInput('x@esempio.invalid\n   \n', ROLE)).toThrow(
      LocalAccountError,
    );
  });
});

describe('rilievo 9: controllo dell’ambiente prima di stdin e campi nominati', () => {
  it('assertAccountIdentityNotInEnv rifiuta ACCOUNT_EMAIL e ACCOUNT_NAME senza riportarne il valore', () => {
    for (const extra of [
      { ACCOUNT_EMAIL: 'in-ambiente@esempio.invalid' },
      { ACCOUNT_NAME: 'Nome In Ambiente' },
    ]) {
      try {
        assertAccountIdentityNotInEnv(extra);
        expect.unreachable('doveva rifiutare');
      } catch (error) {
        expect(error).toBeInstanceOf(LocalAccountError);
        expect((error as Error).message).toContain('stdin');
        expect((error as Error).message).not.toContain('esempio.invalid');
        expect((error as Error).message).not.toContain('Nome In Ambiente');
      }
    }
    expect(() => assertAccountIdentityNotInEnv({ ACCOUNT_ROLE: 'editor' })).not.toThrow();
  });

  it('gli errori di validazione dello stdin nominano «indirizzo» e «nome», non le variabili', () => {
    const ROLE = { ACCOUNT_ROLE: 'amministrazione' };
    const messageOf = (text: string, env = ROLE): string => {
      try {
        parseServerAccountInput(text, env);
      } catch (error) {
        return (error as Error).message;
      }
      return expect.unreachable('doveva rifiutare');
    };
    const bad = messageOf('non-un-indirizzo\nPersona\n');
    expect(bad).toContain('indirizzo');
    expect(bad).not.toContain('ACCOUNT_EMAIL');
    expect(bad).not.toContain('non-un-indirizzo');
    const noName = messageOf('x@esempio.invalid\n   \n');
    expect(noName).toContain('nome');
    expect(noName).not.toContain('ACCOUNT_NAME');
  });
});

describe('parseServerEmailInput (una sola riga di stdin)', () => {
  it('legge una riga, con LF o CRLF, spazi ai bordi e righe vuote finali', () => {
    for (const text of [
      'x@esempio.invalid\n',
      '  x@esempio.invalid \r\n',
      'x@esempio.invalid',
      'x@esempio.invalid\n\n\n',
    ]) {
      expect(parseServerEmailInput(text), JSON.stringify(text)).toBe('x@esempio.invalid');
    }
  });

  it('rifiuta vuoto, riga vuota e due righe non vuote, senza riportare i valori', () => {
    for (const text of ['', '\n', '   \r\n', 'x@esempio.invalid\naltra-riga-sintetica\n']) {
      try {
        parseServerEmailInput(text);
        expect.unreachable(`doveva rifiutare: ${JSON.stringify(text)}`);
      } catch (error) {
        expect(error).toBeInstanceOf(LocalAccountError);
        expect((error as Error).message).toContain('stdin');
        expect((error as Error).message).not.toContain('esempio.invalid');
        expect((error as Error).message).not.toContain('altra-riga-sintetica');
      }
    }
  });
});

describe('readTargetEmail (sblocco e reimpostazione del secondo fattore)', () => {
  const SERVER_URL = 'postgres://u:p@db:5432/amoris';
  const LOCAL_URL = 'postgres://u:p@localhost:5432/amoris';
  async function* lines(text: string): AsyncGenerator<Buffer> {
    yield Buffer.from(text);
  }
  const neverRead: AsyncIterable<Buffer> = {
    [Symbol.asyncIterator]: () => {
      throw new Error('stdin non doveva essere letto');
    },
  };

  const SERVER_ARGV = ['--ambiente', 'production', '--conferma'];
  const SERVER_ENV = { AMORIS_ENV: 'production' };

  it('sul server legge l’indirizzo da stdin con ambiente e conferma', async () => {
    await expect(
      readTargetEmail(
        SERVER_URL,
        SERVER_ARGV,
        SERVER_ENV,
        lines('x@esempio.invalid\n'),
        false,
        'manca',
      ),
    ).resolves.toBe('x@esempio.invalid');
  });

  it('sul server rifiuta ACCOUNT_EMAIL prima di leggere stdin, indicando stdin e non il valore', async () => {
    const env = { ...SERVER_ENV, ACCOUNT_EMAIL: 'in-ambiente@esempio.invalid' };
    const error = await readTargetEmail(
      SERVER_URL,
      SERVER_ARGV,
      env,
      neverRead,
      false,
      'manca',
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LocalAccountError);
    expect((error as Error).message).toContain('stdin');
    expect((error as Error).message).not.toContain('esempio.invalid');
  });

  it('sul server rifiuta un terminale e uno stdin vuoto', async () => {
    await expect(
      readTargetEmail(
        SERVER_URL,
        SERVER_ARGV,
        SERVER_ENV,
        lines('x@esempio.invalid\n'),
        true,
        'manca',
      ),
    ).rejects.toBeInstanceOf(LocalAccountError);
    await expect(
      readTargetEmail(SERVER_URL, SERVER_ARGV, SERVER_ENV, lines(''), false, 'manca'),
    ).rejects.toBeInstanceOf(LocalAccountError);
  });

  it('sul server senza --ambiente, con ambiente sbagliato o senza --conferma rifiuta prima di stdin', async () => {
    const cases: Array<[string[], Record<string, string>, string]> = [
      [['--conferma'], SERVER_ENV, '--ambiente'],
      [['--ambiente', 'production'], SERVER_ENV, '--conferma'],
      [['--ambiente', 'staging', '--conferma'], SERVER_ENV, '--ambiente'],
      [['--ambiente', 'production', '--conferma'], {}, '--ambiente'],
      [['--ambiente', 'sviluppo', '--conferma'], { AMORIS_ENV: 'sviluppo' }, '--ambiente'],
    ];
    for (const [argv, env, fragment] of cases) {
      const error = await readTargetEmail(SERVER_URL, argv, env, neverRead, false, 'manca').catch(
        (e: unknown) => e,
      );
      expect(error, JSON.stringify(argv)).toBeInstanceOf(LocalAccountError);
      expect((error as Error).message).toContain(fragment);
    }
  });

  it('sul server controlla argomenti e ambiente prima del rifiuto di ACCOUNT_EMAIL', async () => {
    const error = await readTargetEmail(
      SERVER_URL,
      [],
      { ...SERVER_ENV, ACCOUNT_EMAIL: 'in-ambiente@esempio.invalid' },
      neverRead,
      false,
      'manca',
    ).catch((e: unknown) => e);
    expect((error as Error).message).toContain('--ambiente');
  });

  it('sul server rifiuta un argomento sconosciuto', async () => {
    await expect(
      readTargetEmail(
        SERVER_URL,
        [...SERVER_ARGV, '--altro'],
        SERVER_ENV,
        neverRead,
        false,
        'manca',
      ),
    ).rejects.toThrow('argomento sconosciuto');
  });

  it('in locale usa ACCOUNT_EMAIL come oggi, senza opzioni né stdin, e segnala la mancanza', async () => {
    await expect(
      readTargetEmail(
        LOCAL_URL,
        [],
        { ACCOUNT_EMAIL: ' x@esempio.invalid ' },
        neverRead,
        false,
        'manca',
      ),
    ).resolves.toBe('x@esempio.invalid');
    await expect(readTargetEmail(LOCAL_URL, [], {}, neverRead, false, 'manca')).rejects.toThrow(
      'manca',
    );
  });

  it('con un host né db né locale si comporta come in locale (come oggi)', async () => {
    await expect(
      readTargetEmail(
        'postgres://u:p@altro.esempio.invalid:5432/amoris',
        [],
        { ACCOUNT_EMAIL: 'x@esempio.invalid' },
        neverRead,
        false,
        'manca',
      ),
    ).resolves.toBe('x@esempio.invalid');
  });
});

describe('readServerInput (stdin con limite e scadenza)', () => {
  async function* chunks(...parts: string[]): AsyncGenerator<Buffer> {
    for (const part of parts) yield Buffer.from(part);
  }

  it('legge tutto lo stream in più pezzi', async () => {
    await expect(readServerInput(chunks('a@esempio', '.invalid\nNo', 'me\n'))).resolves.toBe(
      'a@esempio.invalid\nNome\n',
    );
  });

  it('rifiuta un terminale senza leggere', async () => {
    await expect(
      readServerInput(chunks('a@esempio.invalid\nNome\n'), { isTerminal: true }),
    ).rejects.toBeInstanceOf(LocalAccountError);
  });

  it('rifiuta più dati del limite', async () => {
    await expect(readServerInput(chunks('x'.repeat(40)), { maxBytes: 16 })).rejects.toBeInstanceOf(
      LocalAccountError,
    );
  });

  it('rifiuta uno stream che non finisce entro la scadenza', async () => {
    const never: AsyncIterable<Buffer> = {
      [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => undefined) }),
    };
    await expect(readServerInput(never, { timeoutMs: 50 })).rejects.toBeInstanceOf(
      LocalAccountError,
    );
  });
});

describe('assertLocalDatabase', () => {
  it('accetta un database su questa macchina', () => {
    expect(() => assertLocalDatabase('postgres://u:p@localhost:5432/amoris')).not.toThrow();
    expect(() => assertLocalDatabase('postgres://u:p@127.0.0.1:5432/amoris')).not.toThrow();
  });

  it('rifiuta un database remoto', () => {
    expect(() => assertLocalDatabase('postgres://u:p@db.esempio.invalid:5432/amoris')).toThrow(
      LocalAccountError,
    );
  });
});

describe('resolveAccountMode', () => {
  const SERVER_URL = 'postgres://u:p@db:5432/amoris';
  const ENV = { AMORIS_ENV: 'production' };
  const OK = ['--ambiente', 'production', '--conferma'];

  it('accetta il modo server solo con db, ambiente uguale e conferma', () => {
    expect(resolveAccountMode(SERVER_URL, OK, ENV)).toBe('server');
    expect(
      resolveAccountMode(SERVER_URL, ['--conferma', '--ambiente', 'staging'], {
        AMORIS_ENV: 'staging',
      }),
    ).toBe('server');
  });

  it('rifiuta senza conferma, con ambiente diverso, senza AMORIS_ENV o con un ambiente sconosciuto', () => {
    expect(() => resolveAccountMode(SERVER_URL, ['--ambiente', 'production'], ENV)).toThrow(
      LocalAccountError,
    );
    expect(() => resolveAccountMode(SERVER_URL, OK, { AMORIS_ENV: 'staging' })).toThrow(
      LocalAccountError,
    );
    expect(() => resolveAccountMode(SERVER_URL, OK, {})).toThrow(LocalAccountError);
    expect(() =>
      resolveAccountMode(SERVER_URL, ['--ambiente', 'prova', '--conferma'], {
        AMORIS_ENV: 'prova',
      }),
    ).toThrow(LocalAccountError);
    expect(() => resolveAccountMode(SERVER_URL, ['--conferma'], ENV)).toThrow(LocalAccountError);
    expect(() => resolveAccountMode(SERVER_URL, [], ENV)).toThrow(LocalAccountError);
  });

  it('rifiuta un argomento sconosciuto e ACCOUNT_PASSWORD sul server', () => {
    expect(() => resolveAccountMode(SERVER_URL, [...OK, '--forza'], ENV)).toThrow(
      LocalAccountError,
    );
    expect(() => resolveAccountMode('postgres://u:p@localhost/amoris', ['--forza'], ENV)).toThrow(
      LocalAccountError,
    );
    expect(() =>
      resolveAccountMode(SERVER_URL, OK, { ...ENV, ACCOUNT_PASSWORD: PASSWORD }),
    ).toThrow(LocalAccountError);
  });

  it('rifiuta ogni altro host non locale e lascia invariato il modo locale', () => {
    expect(() => resolveAccountMode('postgres://u:p@db.esempio.invalid/amoris', OK, ENV)).toThrow(
      LocalAccountError,
    );
    expect(() => resolveAccountMode('postgres://u:p@database/amoris', OK, ENV)).toThrow(
      LocalAccountError,
    );
    expect(
      resolveAccountMode('postgres://u:p@localhost:5432/amoris', [], {
        ACCOUNT_PASSWORD: PASSWORD,
      }),
    ).toBe('local');
  });
});

describe('account senza password (password temporanea)', () => {
  it('genera la password, la salva come hash e impone il cambio al primo accesso', async () => {
    const result = await createLocalAccount(harness.db, harness.config, {
      email: 'temporanea@esempio.invalid',
      fullName: 'Persona temporanea',
      roleKey: 'editor',
    });
    expect(result.temporaryPassword).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
    const [user] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, result.userId));
    expect(user!.mustChangePassword).toBe(true);
    expect(user!.passwordHash).not.toContain(result.temporaryPassword!);
    expect(await verifyPassword(user!.passwordHash!, result.temporaryPassword!)).toBe(true);
  });

  it('con la password data il modo locale non la impone temporanea e non la restituisce', async () => {
    const result = await createLocalAccount(harness.db, harness.config, {
      email: 'locale-fissa@esempio.invalid',
      fullName: 'Persona locale',
      password: PASSWORD,
      roleKey: 'editor',
    });
    expect(result.temporaryPassword).toBeUndefined();
    const [user] = await harness.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, result.userId));
    expect(user!.mustChangePassword).toBe(false);
  });

  it('parseLocalAccountInput accetta l assenza della password', () => {
    expect(
      parseLocalAccountInput({
        ACCOUNT_EMAIL: 'x@esempio.invalid',
        ACCOUNT_NAME: 'X',
        ACCOUNT_ROLE: 'editor',
      }).password,
    ).toBeUndefined();
  });

  it('con la password temporanea si accede, serve il TOTP e poi il cambio (catena già provata in secondFactor e passwordChange)', async () => {
    const result = await createLocalAccount(harness.db, harness.config, {
      email: 'catena@esempio.invalid',
      fullName: 'Persona catena',
      roleKey: 'editor',
    });
    const login = await harness.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'catena@esempio.invalid', password: result.temporaryPassword },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().mustChangePassword).toBe(true);
    expect(login.json().secondFactor).toBe('activation_required');
    const cookie = (login.cookies as { name: string; value: string }[])
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const refused = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie },
    });
    expect(refused.statusCode).toBe(403);
    expect(refused.json().error.code).toBe('SECOND_FACTOR_REQUIRED');
  });
});
