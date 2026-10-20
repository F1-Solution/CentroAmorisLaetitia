import { schema } from '@amoris/db';
import { count, eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL,
  BOTH_EMAIL,
  TEST_EMAIL,
  TEST_PASSWORD,
  createHarness,
  signIn,
  type Harness,
} from './_support/harness.js';

/**
 * DR-227: il ruolo `amministrazione` ha tre permessi propri e la redazione non
 * entra più nell'area Impostazioni. Dati sintetici.
 */

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness('api_permessi');
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

async function areasOf(email: string): Promise<string[]> {
  const response = await harness.app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });
  const body = response.json() as { rolesHeld: { areas: string[] }[] };
  return [...new Set(body.rolesHeld.flatMap((role) => role.areas))].sort();
}

describe('aree raggiungibili per ruolo', () => {
  it('con il solo ruolo di redazione si raggiunge solo Redazione', async () => {
    expect(await areasOf(TEST_EMAIL)).toEqual(['redazione']);
  });

  it('con il solo ruolo di amministrazione si raggiunge solo Impostazioni', async () => {
    expect(await areasOf(ADMIN_EMAIL)).toEqual(['impostazioni']);
  });

  it('con entrambi i ruoli si raggiungono entrambe le aree', async () => {
    expect(await areasOf(BOTH_EMAIL)).toEqual(['impostazioni', 'redazione']);
  });
});

describe('impostazioni del sito', () => {
  it('la redazione non legge né modifica le impostazioni', async () => {
    const signed = await signIn(harness, { area: 'redazione' });
    const read = await harness.app.inject({
      method: 'GET',
      url: '/settings',
      headers: { cookie: signed.cookie },
    });
    expect(read.statusCode).toBe(403);
    const write = await harness.app.inject({
      method: 'PUT',
      url: '/settings/site.title',
      headers: signed.writeHeaders,
      payload: { value: 'x' },
    });
    expect(write.statusCode).toBe(403);
  });

  it('la redazione non può scegliere la veste Impostazioni', async () => {
    await expect(signIn(harness, { area: 'impostazioni' })).rejects.toThrow();
  });

  it('l’amministrazione legge le impostazioni e non i contenuti', async () => {
    const signed = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
    const settings = await harness.app.inject({
      method: 'GET',
      url: '/settings',
      headers: { cookie: signed.cookie },
    });
    expect(settings.statusCode).toBe(200);
    const me = await harness.app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: signed.cookie },
    });
    expect([...me.json().permissions].sort()).toEqual([
      'audit.read',
      'site.settings.write',
      'users.manage',
    ]);
    const contents = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: signed.cookie },
    });
    expect(contents.statusCode).toBe(403);
  });

  it('SEO e redirect restano alla redazione con settings.write', async () => {
    const signed = await signIn(harness, { area: 'redazione' });
    const response = await harness.app.inject({
      method: 'POST',
      url: '/redirects',
      headers: signed.writeHeaders,
      payload: { sourcePath: '/vecchio-permessi/', targetPath: '/nuovo-permessi/' },
    });
    expect(response.statusCode).toBe(201);
  });
});

describe('migrazione dei permessi', () => {
  const folder = path.join(
    path.dirname(createRequire(import.meta.url).resolve('@amoris/db')),
    '..',
    'drizzle',
  );

  it('applicata di nuovo lascia 8 permessi e 3 per l’amministrazione', async () => {
    const file = readdirSync(folder).find((name) => name.endsWith('_amministrazione.sql'));
    expect(file, 'migrazione _amministrazione.sql mancante').toBeDefined();
    const statements = readFileSync(path.join(folder, file ?? ''), 'utf8')
      .split('--> statement-breakpoint')
      .map((part) => part.trim())
      .filter(Boolean);
    for (const statement of statements) await harness.db.$client.unsafe(statement);

    const [permissionCount] = await harness.db.select({ n: count() }).from(schema.permissions);
    expect(permissionCount?.n).toBe(8);

    const [role] = await harness.db
      .select({ id: schema.roles.id, label: schema.roles.label, isSystem: schema.roles.isSystem })
      .from(schema.roles)
      .where(eq(schema.roles.key, 'amministrazione'));
    expect(role).toMatchObject({ label: 'Amministrazione', isSystem: true });
    const [rolePermissions] = await harness.db
      .select({ n: count() })
      .from(schema.rolePermissions)
      .where(eq(schema.rolePermissions.roleId, role?.id ?? ''));
    expect(rolePermissions?.n).toBe(3);
  });
});
