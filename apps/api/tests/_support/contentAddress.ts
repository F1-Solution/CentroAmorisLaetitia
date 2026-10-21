import { schema } from '@amoris/db';
import { asc, sql } from 'drizzle-orm';
import type { Permission } from '../../src/auth/permissions.js';
import { hashPassword } from '../../src/lib/password.js';
import { planAddressChange } from '../../src/modules/content/address.js';
import { createHarness, signIn, TEST_PASSWORD, type Harness, type Signed } from './harness.js';

/**
 * Aiuti comuni alle prove del cambio d'indirizzo (wave 1G-W3): contenuti, gerarchie e
 * regole scritti direttamente nel database di prova, la fotografia di `contents` e
 * `redirects`, il banco con la pagina iniziale. Dati sintetici.
 */

export interface ContentSeed {
  readonly slug: string;
  readonly path: string;
  readonly parentId?: string | null;
  readonly status?: 'draft' | 'published';
  readonly type?: 'page' | 'post';
}

export interface Tree {
  readonly a: string;
  readonly b: string;
  readonly c: string;
  readonly d: string;
}

export interface RuleSeed {
  readonly origin?: 'migration' | 'manual' | 'automatic';
  readonly kind?: 'exact' | 'prefix';
  readonly isActive?: boolean;
  readonly statusCode?: 301 | 302;
}

/** Gli aiuti legati al banco del file di prova, che si legge solo quando servono (dopo `beforeAll`). */
export function addressFixtures(current: () => Harness) {
  async function insertContent(seed: ContentSeed): Promise<string> {
    const status = seed.status ?? 'published';
    const [row] = await current()
      .db.insert(schema.contents)
      .values({
        type: seed.type ?? 'page',
        status,
        slug: seed.slug,
        path: seed.path,
        parentId: seed.parentId ?? null,
        title: `Titolo ${seed.slug}`,
        publishedAt: status === 'published' ? new Date() : null,
      })
      .returning({ id: schema.contents.id });
    if (!row) throw new Error('contenuto di prova non creato');
    return row.id;
  }

  /** A pubblicata > B (pubblicata o in bozza) > C pubblicata, più D in bozza sotto B. */
  async function tree(prefix: string, bStatus: 'draft' | 'published' = 'published'): Promise<Tree> {
    const a = await insertContent({ slug: prefix, path: `/${prefix}/` });
    const b = await insertContent({
      slug: 'b',
      path: `/${prefix}/b/`,
      parentId: a,
      status: bStatus,
    });
    const c = await insertContent({ slug: 'c', path: `/${prefix}/b/c/`, parentId: b });
    const d = await insertContent({
      slug: 'd',
      path: `/${prefix}/b/d/`,
      parentId: b,
      status: 'draft',
    });
    return { a, b, c, d };
  }

  async function rule(sourcePath: string, targetPath: string, seed: RuleSeed = {}): Promise<void> {
    await current()
      .db.insert(schema.redirects)
      .values({
        sourcePath,
        targetPath,
        origin: seed.origin ?? 'manual',
        kind: seed.kind ?? 'exact',
        isActive: seed.isActive ?? true,
        statusCode: seed.statusCode ?? 301,
      });
  }

  /** Tutte le righe di `contents` e `redirects`: un rifiuto non deve cambiarne nessuna. */
  async function tables() {
    const { db } = current();
    return {
      contents: await db.select().from(schema.contents).orderBy(asc(schema.contents.id)),
      redirects: await db.select().from(schema.redirects).orderBy(asc(schema.redirects.id)),
    };
  }

  const plan = (id: string, slug: string, parentId: string | null) =>
    planAddressChange(current().db, id, { slug, parentId });

  return { insertContent, tree, rule, tables, plan };
}

export interface AddressBench {
  readonly harness: Harness;
  readonly signed: Signed;
  readonly homeId: string;
}

/** Un banco con una persona di Redazione e una pagina iniziale sintetica. */
export async function createAddressBench(namePrefix: string): Promise<AddressBench> {
  const harness = await createHarness(namePrefix);
  const signed = await signIn(harness, { area: 'redazione' });
  const homeId = await addressFixtures(() => harness).insertContent({
    slug: 'casa-sintetica',
    path: '/casa-sintetica/',
  });
  await harness.db
    .insert(schema.settings)
    .values({ key: 'site.home_content_id', value: homeId, label: 'Pagina iniziale' });
  return { harness, signed, homeId };
}

/** Una persona sintetica il cui unico ruolo, di Redazione, ha solo questi permessi (D138-A). */
export async function signInWithPermissions(
  harness: Harness,
  key: string,
  permissions: readonly Permission[],
): Promise<Signed> {
  const [role] = await harness.db
    .insert(schema.roles)
    .values({ key, label: `Ruolo sintetico ${key}`, isSystem: false })
    .returning({ id: schema.roles.id });
  if (!role) throw new Error('ruolo di prova non creato');
  await harness.db
    .insert(schema.rolePermissions)
    .values(permissions.map((permissionKey) => ({ roleId: role.id, permissionKey })));
  const email = `${key}@esempio.invalid`;
  const passwordHash = await hashPassword(TEST_PASSWORD, harness.config);
  const [user] = await harness.db
    .insert(schema.users)
    .values({ email, fullName: `Persona ${key}`, passwordHash })
    .returning({ id: schema.users.id });
  if (!user) throw new Error('persona di prova non creata');
  await harness.db.insert(schema.userRoles).values({ userId: user.id, roleId: role.id });
  return signIn(harness, { email, area: 'redazione' });
}

type Occupy = Parameters<Parameters<Harness['db']['transaction']>[0]>[0];

/** Attende che una richiesta di questo database sia ferma su un blocco. */
async function untilBlocked(harness: Harness): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const [row] = await harness.db.execute<{ n: number }>(
      sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`,
    );
    if ((row?.n ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('lo spostamento non si è mai fermato sulla riga concorrente');
}

/**
 * Un'altra transazione scrive la riga e resta aperta: il piano non la vede, la
 * scrittura dello spostamento la attende e, al commit dell'altra, trova la riga.
 * L'altra transazione si chiude anche se l'attesa fallisce: il file non resta appeso.
 */
export async function inRace<T>(
  harness: Harness,
  occupy: (tx: Occupy) => Promise<unknown>,
  request: () => Promise<T>,
): Promise<T> {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let occupied = (): void => undefined;
  const ready = new Promise<void>((resolve) => {
    occupied = resolve;
  });
  const other = harness.db.transaction(async (tx) => {
    await occupy(tx);
    occupied();
    await held;
  });
  await ready;
  const pending = Promise.resolve(request());
  try {
    await untilBlocked(harness);
  } finally {
    release();
    await other;
  }
  return pending;
}
