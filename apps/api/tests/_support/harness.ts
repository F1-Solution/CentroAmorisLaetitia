import { schema, type Database } from '@amoris/db';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Readable } from 'node:stream';
import postgres from 'postgres';
import { buildApp } from '../../src/app.js';
import { loadConfig, type Config } from '../../src/config.js';
import type { AdminArea } from '../../src/auth/areas.js';
import { ALL_PERMISSIONS } from '../../src/auth/permissions.js';
import { hashPassword } from '../../src/lib/password.js';
import type { ObjectStore } from '../../src/lib/objectStore.js';

/**
 * Banco di prova del servizio: un database usa e getta per file di test, con le
 * migrazioni vere applicate, e un archivio a oggetti finto.
 *
 * **Nessun dato reale.** Indirizzo, nome e password sono sintetici e vivono solo
 * dentro il database temporaneo, che viene distrutto alla fine.
 */

const migrationsFolder = path.join(
  path.dirname(createRequire(import.meta.url).resolve('@amoris/db')),
  '..',
  'drizzle',
);

const baseUrl =
  process.env.DATABASE_URL ?? 'postgres://amoris:sviluppo-locale@localhost:5432/amoris';

function urlForDatabase(name: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

export const TEST_EMAIL = 'redattore.sintetico@esempio.invalid';
export const TEST_PASSWORD = 'password-sintetica-di-prova';
export const TEST_FULL_NAME = 'Redattore Sintetico';

/**
 * Archivio a oggetti finto: registra le chiamate, non tocca alcun bucket.
 * `objects` tiene in memoria ciò che si carica, così che una prova possa
 * anche rileggerlo.
 */
export function fakeObjectStore(): ObjectStore & {
  readonly puts: string[];
  readonly objects: Map<string, Buffer>;
} {
  const puts: string[] = [];
  const objects = new Map<string, Buffer>();
  return {
    puts,
    objects,
    publicBucket: 'media-public',
    privateBucket: 'media-private',
    async put(bucket, key, body) {
      puts.push(`${bucket}/${key}`);
      objects.set(`${bucket}/${key}`, body);
    },
    async get(bucket, key, range) {
      const stored = objects.get(`${bucket}/${key}`);
      if (!stored) return null;
      // Come lo storage vero, con un intervallo restituisce solo quei byte.
      const body = range ? stored.subarray(range.start, range.end + 1) : stored;
      return { body: Readable.from(body), contentLength: body.length };
    },
    async remove(bucket, key) {
      objects.delete(`${bucket}/${key}`);
    },
  };
}

export function testConfig(databaseUrl: string, overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    DATABASE_URL: databaseUrl,
    IP_HASH_SALT: 'sale-sintetico-per-i-test-abbastanza-lungo',
    CSRF_SECRET: 'segreto-sintetico-per-i-test-abbastanza-lungo',
    // I test non devono aspettare mezzo secondo per ogni accesso.
    LOGIN_UNIFORM_MS: '0',
    LOGIN_DELAY_STEP_MS: '0',
    ...overrides,
  });
}

export interface Harness {
  readonly app: Awaited<ReturnType<typeof buildApp>>;
  readonly db: Database;
  readonly config: Config;
  readonly store: ReturnType<typeof fakeObjectStore>;
  readonly userId: string;
  teardown(): Promise<void>;
}

export async function createHarness(
  namePrefix: string,
  overrides: Record<string, string> = {},
): Promise<Harness> {
  const name = `${namePrefix}_${process.pid}_${Date.now()}`;
  const admin = postgres(urlForDatabase('postgres'), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);

  const migrationClient = postgres(urlForDatabase(name), { max: 1, onnotice: () => {} });
  await migrate(drizzle(migrationClient), { migrationsFolder });
  await migrationClient.end({ timeout: 5 });

  const config = testConfig(urlForDatabase(name), overrides);
  const store = fakeObjectStore();
  const app = await buildApp(config, { objectStore: store });
  await app.ready();

  // Un ruolo, i cinque permessi di ADR-007 §3.2, una persona.
  const [role] = await app.db
    .insert(schema.roles)
    .values({ key: 'editor', label: 'Redattore', isSystem: true })
    .returning({ id: schema.roles.id });
  if (!role) throw new Error('ruolo di prova non creato');

  await app.db
    .insert(schema.permissions)
    .values(ALL_PERMISSIONS.map((key) => ({ key, label: key })));
  await app.db
    .insert(schema.rolePermissions)
    .values(ALL_PERMISSIONS.map((key) => ({ roleId: role.id, permissionKey: key })));

  const [user] = await app.db
    .insert(schema.users)
    .values({
      email: TEST_EMAIL,
      fullName: TEST_FULL_NAME,
      passwordHash: await hashPassword(TEST_PASSWORD, config),
    })
    .returning({ id: schema.users.id });
  if (!user) throw new Error('persona di prova non creata');

  await app.db.insert(schema.userRoles).values({ userId: user.id, roleId: role.id });

  return {
    app,
    db: app.db,
    config,
    store,
    userId: user.id,
    async teardown() {
      await app.close();
      await admin.unsafe(`drop database if exists "${name}" with (force)`);
      await admin.end({ timeout: 5 });
    },
  };
}

export interface Signed {
  /** Intestazione `cookie` da rimandare. */
  readonly cookie: string;
  /** Token anti-CSRF, da mettere in `x-csrf-token`. */
  readonly csrf: string;
  /** Intestazioni pronte per una richiesta che modifica dati. */
  readonly writeHeaders: Record<string, string>;
}

export interface SignInOptions {
  readonly email?: string;
  readonly password?: string;
  /**
   * Veste da indossare dopo l'accesso. La persona di prova possiede il ruolo
   * `editor`, che fa entrare in **due** aree: quindi non c'è scelta automatica
   * e senza questo passo la sessione non è in alcuna area, come per una persona
   * vera ferma sulla schermata di scelta (`ux-proposals.md` §4.3).
   */
  readonly area?: AdminArea | null;
}

/** Esegue l'accesso, sceglie la veste e restituisce ciò che serve dopo. */
export async function signIn(harness: Harness, options: SignInOptions = {}): Promise<Signed> {
  const { email = TEST_EMAIL, password = TEST_PASSWORD, area = 'redazione' } = options;
  const response = await harness.app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  if (response.statusCode !== 200) {
    throw new Error(`accesso di prova fallito: ${response.statusCode} ${response.body}`);
  }

  const cookies = response.cookies as { name: string; value: string }[];
  const session = cookies.find((entry) => entry.name === harness.config.SESSION_COOKIE_NAME);
  const csrf = cookies.find((entry) => entry.name === harness.config.CSRF_COOKIE_NAME);
  if (!session || !csrf) throw new Error('i cookie di sessione non sono stati impostati');

  const cookie = `${session.name}=${session.value}; ${csrf.name}=${csrf.value}`;
  const signed: Signed = {
    cookie,
    csrf: csrf.value,
    writeHeaders: { cookie, 'x-csrf-token': csrf.value },
  };

  if (area) {
    const body = response.json() as { rolesHeld: { roleId: string; areas: string[] }[] };
    const role = body.rolesHeld.find((held) => held.areas.includes(area));
    if (!role) throw new Error(`la persona di prova non può entrare nell'area ${area}`);
    const chosen = await harness.app.inject({
      method: 'POST',
      url: '/auth/context',
      headers: signed.writeHeaders,
      payload: { roleId: role.roleId, area },
    });
    if (chosen.statusCode !== 200) {
      throw new Error(`scelta della veste fallita: ${chosen.statusCode} ${chosen.body}`);
    }
  }

  return signed;
}
