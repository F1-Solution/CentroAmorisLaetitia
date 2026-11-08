import { schema, type Database } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Readable } from 'node:stream';
import postgres from 'postgres';
import { buildApp } from '../../src/app.js';
import { loadConfig, type Config } from '../../src/config.js';
import type { AdminArea } from '../../src/auth/areas.js';
import { PERMISSIONS } from '../../src/auth/permissions.js';
import { tokenDigest } from '../../src/lib/crypto.js';
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

/** I cinque permessi che il ruolo `editor` ha sempre avuto. */
const EDITOR_PERMISSIONS = [
  PERMISSIONS.contentRead,
  PERMISSIONS.contentWrite,
  PERMISSIONS.contentPublish,
  PERMISSIONS.mediaWrite,
  PERMISSIONS.settingsWrite,
] as const;

export const TEST_EMAIL = 'redattore.sintetico@esempio.invalid';
export const TEST_PASSWORD = 'password-sintetica-di-prova';
export const TEST_FULL_NAME = 'Redattore Sintetico';

/** Persona con il solo ruolo `amministrazione` (DR-227). */
export const ADMIN_EMAIL = 'amministrazione.sintetica@esempio.invalid';
/** Persona con entrambi i ruoli. */
export const BOTH_EMAIL = 'entrambi.sintetici@esempio.invalid';

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
    TOTP_ENCRYPTION_KEY: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
    // I test non devono aspettare mezzo secondo per ogni accesso.
    LOGIN_UNIFORM_MS: '0',
    LOGIN_DELAY_STEP_MS: '0',
    // Le prove arrivano da 127.0.0.1 e a volte simulano il proxy con `X-Forwarded-For`.
    TRUSTED_PROXY: '127.0.0.1',
    // Molti accessi e letture dallo stesso indirizzo: i tetti HTTP si abbassano solo nelle prove dedicate.
    HTTP_ANON_WRITES_PER_MINUTE: '100000',
    HTTP_PUBLIC_READ_PER_MINUTE: '100000',
    // Le prove caricano molti file dallo stesso indirizzo.
    MEDIA_WRITES_PER_MINUTE: '100000',
    // I programmi della pulizia dei metadati: in locale `qpdf` può stare fuori dal PATH.
    ...(process.env.QPDF_PATH ? { QPDF_PATH: process.env.QPDF_PATH } : {}),
    ...(process.env.FFMPEG_PATH ? { FFMPEG_PATH: process.env.FFMPEG_PATH } : {}),
    ...(process.env.FFPROBE_PATH ? { FFPROBE_PATH: process.env.FFPROBE_PATH } : {}),
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

  // Il ruolo `editor` con i cinque permessi storici; permessi e ruolo `amministrazione`
  // arrivano dalla migrazione (DR-227).
  const [role] = await app.db
    .insert(schema.roles)
    .values({ key: 'editor', label: 'Redazione', isSystem: true })
    .returning({ id: schema.roles.id });
  if (!role) throw new Error('ruolo di prova non creato');
  await app.db
    .insert(schema.rolePermissions)
    .values(EDITOR_PERMISSIONS.map((key) => ({ roleId: role.id, permissionKey: key })));

  const [adminRole] = await app.db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.key, 'amministrazione'));
  if (!adminRole) throw new Error('il ruolo amministrazione manca: lo semina la migrazione');

  const passwordHash = await hashPassword(TEST_PASSWORD, config);
  const people = await app.db
    .insert(schema.users)
    .values([
      { email: TEST_EMAIL, fullName: TEST_FULL_NAME, passwordHash },
      { email: ADMIN_EMAIL, fullName: 'Amministrazione Sintetica', passwordHash },
      { email: BOTH_EMAIL, fullName: 'Entrambi Sintetici', passwordHash },
    ])
    .returning({ id: schema.users.id, email: schema.users.email });
  const idOf = (email: string): string => {
    const found = people.find((person) => person.email === email);
    if (!found) throw new Error('persona di prova non creata');
    return found.id;
  };
  const userId = idOf(TEST_EMAIL);

  await app.db.insert(schema.userRoles).values([
    { userId, roleId: role.id },
    { userId: idOf(ADMIN_EMAIL), roleId: adminRole.id },
    { userId: idOf(BOTH_EMAIL), roleId: role.id },
    { userId: idOf(BOTH_EMAIL), roleId: adminRole.id },
  ]);

  return {
    app,
    db: app.db,
    config,
    store,
    userId,
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
   * Veste da indossare dopo l'accesso. Chi ha entrambi i ruoli può entrare in
   * **due** aree: non c'è scelta automatica e senza questo passo la sessione non
   * è in alcuna area (`ux-proposals.md` §4.3).
   */
  readonly area?: AdminArea | null;
  /**
   * Di norma la sessione di prova nasce con il secondo fattore già verificato e confermata ora, così le prove
   * che non riguardano il TOTP non lo ripetono; `false` lascia la sessione in attesa, come in produzione.
   */
  readonly secondFactorVerified?: boolean;
}

/** Segna come verificata e confermata la sessione del cookie dato, direttamente a database. */
export async function verifySessionDirectly(harness: Harness, token: string): Promise<void> {
  const now = new Date();
  await harness.db
    .update(schema.sessions)
    .set({ secondFactorVerifiedAt: now, lastConfirmedAt: now })
    .where(eq(schema.sessions.tokenDigest, tokenDigest(token)));
}

/** Esegue l'accesso, sceglie la veste e restituisce ciò che serve dopo. */
export async function signIn(harness: Harness, options: SignInOptions = {}): Promise<Signed> {
  const {
    email = TEST_EMAIL,
    password = TEST_PASSWORD,
    area = 'redazione',
    secondFactorVerified = true,
  } = options;
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

  if (secondFactorVerified) await verifySessionDirectly(harness, session.value);

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
