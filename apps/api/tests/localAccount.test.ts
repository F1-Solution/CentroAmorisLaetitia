import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertLocalDatabase,
  createLocalAccount,
  LocalAccountError,
  parseLocalAccountInput,
} from '../src/accounts/localAccount.js';
import { verifyPassword } from '../src/lib/password.js';
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
