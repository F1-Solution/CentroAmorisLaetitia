import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { menusStage } from '../../../src/stages/menus/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, { isDryRun: false, sourceLabel: 'BackupDB-2026-09-13', importerVersion: '0.0.0-test' });
}

const OPTIONS = { only: null, forceContentIds: [] as readonly string[], verbose: false };

const WP_TERMS: readonly SqlRow[] = [{ term_id: 3, name: 'Menu principale', slug: 'menu-principale', term_group: 0 }];
const WP_TERM_TAXONOMY: readonly SqlRow[] = [
  { term_taxonomy_id: 1, term_id: 3, taxonomy: 'nav_menu', description: '', parent: 0, count: 6 },
  // orfana: nessuna riga wp_terms corrispondente, si scarta come in terms/index.ts
  { term_taxonomy_id: 2, term_id: 999, taxonomy: 'nav_menu', description: '', parent: 0, count: 0 },
];

function menuRelationship(objectId: number): SqlRow {
  return { object_id: objectId, term_taxonomy_id: 1, term_order: 0 };
}

const NAV_ITEM_IDS = { root: 500, child: 501, grandchild: 505, authenticated: 502, roles: 503, unresolved: 504 };

const WP_POSTS: readonly SqlRow[] = [
  { ID: NAV_ITEM_IDS.root, post_type: 'nav_menu_item', post_title: 'Chi siamo', menu_order: 1, post_status: 'publish' },
  { ID: NAV_ITEM_IDS.child, post_type: 'nav_menu_item', post_title: 'Vecchia edizione', menu_order: 1, post_status: 'publish' },
  {
    ID: NAV_ITEM_IDS.grandchild,
    post_type: 'nav_menu_item',
    post_title: 'Livello profondo',
    menu_order: 1,
    post_status: 'publish',
  },
  { ID: NAV_ITEM_IDS.authenticated, post_type: 'nav_menu_item', post_title: 'Area riservata', menu_order: 2, post_status: 'publish' },
  { ID: NAV_ITEM_IDS.roles, post_type: 'nav_menu_item', post_title: 'Vecchia pagina', menu_order: 3, post_status: 'publish' },
  {
    ID: NAV_ITEM_IDS.unresolved,
    post_type: 'nav_menu_item',
    post_title: 'Categoria download',
    menu_order: 4,
    post_status: 'publish',
  },
];

const WP_TERM_RELATIONSHIPS: readonly SqlRow[] = Object.values(NAV_ITEM_IDS).map(menuRelationship);

function postmeta(postId: number, key: string, value: string): SqlRow {
  return { meta_id: postId * 100 + key.length, post_id: postId, meta_key: key, meta_value: value };
}

const WP_POSTMETA: readonly SqlRow[] = [
  // root: contenuto, pubblica
  postmeta(NAV_ITEM_IDS.root, '_menu_item_type', 'post_type'),
  postmeta(NAV_ITEM_IDS.root, '_menu_item_object', 'page'),
  postmeta(NAV_ITEM_IDS.root, '_menu_item_object_id', '100'),
  postmeta(NAV_ITEM_IDS.root, '_menu_item_menu_item_parent', '0'),

  // figlio di root: custom, sempre nascosta (hide, nessun ruolo)
  postmeta(NAV_ITEM_IDS.child, '_menu_item_type', 'custom'),
  postmeta(NAV_ITEM_IDS.child, '_menu_item_url', 'https://esempio.test/vecchia-edizione'),
  postmeta(NAV_ITEM_IDS.child, '_menu_item_menu_item_parent', String(NAV_ITEM_IDS.root)),
  postmeta(NAV_ITEM_IDS.child, '_nav_menu_role_display_mode', 'hide'),

  // nipote di root, figlio del figlio: livello profondo
  postmeta(NAV_ITEM_IDS.grandchild, '_menu_item_type', 'custom'),
  postmeta(NAV_ITEM_IDS.grandchild, '_menu_item_url', 'https://esempio.test/livello-profondo'),
  postmeta(NAV_ITEM_IDS.grandchild, '_menu_item_menu_item_parent', String(NAV_ITEM_IDS.child)),

  // autenticati soltanto
  postmeta(NAV_ITEM_IDS.authenticated, '_menu_item_type', 'custom'),
  postmeta(NAV_ITEM_IDS.authenticated, '_menu_item_url', 'https://esempio.test/riservata'),
  postmeta(NAV_ITEM_IDS.authenticated, '_menu_item_menu_item_parent', '0'),
  postmeta(NAV_ITEM_IDS.authenticated, '_nav_menu_role', 'in'),

  // solo amministratori
  postmeta(NAV_ITEM_IDS.roles, '_menu_item_type', 'custom'),
  postmeta(NAV_ITEM_IDS.roles, '_menu_item_url', 'https://esempio.test/vecchia-pagina'),
  postmeta(NAV_ITEM_IDS.roles, '_menu_item_menu_item_parent', '0'),
  postmeta(NAV_ITEM_IDS.roles, '_nav_menu_role', 'a:1:{i:1;s:13:"administrator";}'),

  // voce di tassonomia non risolvibile (wpdmcategory: terms/index.ts non la importa)
  postmeta(NAV_ITEM_IDS.unresolved, '_menu_item_type', 'taxonomy'),
  postmeta(NAV_ITEM_IDS.unresolved, '_menu_item_object', 'wpdmcategory'),
  postmeta(NAV_ITEM_IDS.unresolved, '_menu_item_object_id', '9999'),
  postmeta(NAV_ITEM_IDS.unresolved, '_menu_item_menu_item_parent', '0'),
];

function buildSource(extraPosts: readonly SqlRow[] = [], extraMeta: readonly SqlRow[] = []) {
  return fakeSourceReader({
    wp_terms: WP_TERMS,
    wp_term_taxonomy: WP_TERM_TAXONOMY,
    wp_posts: [...WP_POSTS, ...extraPosts],
    wp_postmeta: [...WP_POSTMETA, ...extraMeta],
    wp_term_relationships: WP_TERM_RELATIONSHIPS,
  });
}

async function seedContentPage(db: Database): Promise<string> {
  const [content] = await db
    .insert(schema.contents)
    .values({ type: 'page', status: 'draft', slug: 'chi-siamo', path: '/chi-siamo/', title: 'Chi siamo', legacyId: 100 })
    .returning({ id: schema.contents.id });
  await db.insert(schema.importIdMap).values({ sourceTable: 'wp_posts', sourceId: 100, entity: 'content', entityId: content!.id });
  return content!.id;
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_menus');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase menus', () => {
  it('importa il menu e le sue voci, con i quattro casi di visibilità e la gerarchia a più livelli', async () => {
    await seedContentPage(testDb.db);

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(menusStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(5); // root, figlio, nipote, autenticati, ruoli
    expect(result.skipped).toBe(1); // wpdmcategory non risolvibile
    expect(result.errors).toBe(0);

    const menus = await testDb.db.select().from(schema.menus);
    expect(menus).toHaveLength(1);
    expect(menus[0]?.key).toBe('menu-principale');

    const items = await testDb.db.select().from(schema.menuItems);
    expect(items).toHaveLength(5);

    const root = items.find((i) => i.legacyId === NAV_ITEM_IDS.root);
    const child = items.find((i) => i.legacyId === NAV_ITEM_IDS.child);
    const grandchild = items.find((i) => i.legacyId === NAV_ITEM_IDS.grandchild);
    const authenticated = items.find((i) => i.legacyId === NAV_ITEM_IDS.authenticated);
    const roles = items.find((i) => i.legacyId === NAV_ITEM_IDS.roles);

    expect(root?.kind).toBe('content');
    expect(root?.visibility).toBe('public');
    expect(root?.parentId).toBeNull();

    expect(child?.visibility).toBe('hidden');
    expect(child?.parentId).toBe(root?.id);

    expect(grandchild?.parentId).toBe(child?.id); // tre livelli

    expect(authenticated?.visibility).toBe('authenticated');
    expect(authenticated?.visibleToRoles).toEqual([]);

    expect(roles?.visibility).toBe('roles');
    expect(roles?.visibleToRoles).toEqual(['administrator']);

    const warning = issues.collected.find((i) => i.detail === 'unresolved-term-reference');
    expect(warning).toBeDefined();
    expect(warning?.sourceId).toBe(NAV_ITEM_IDS.unresolved);
  });

  it('il vincolo che vieta i ruoli fuori da `roles` fallisce quando deve', async () => {
    const fresh = await createTestDatabase('amoris_importer_menus_role_constraint');
    try {
      await fresh.db.insert(schema.menus).values({ key: 'test', label: 'Test' }).returning({ id: schema.menus.id });
      const [menu] = await fresh.db.select().from(schema.menus);
      await expect(
        fresh.db.insert(schema.menuItems).values({
          menuId: menu!.id,
          kind: 'custom',
          label: 'Vietata',
          url: 'https://esempio.test/',
          visibility: 'public', // non 'roles'
          visibleToRoles: ['administrator'], // ma con ruoli: deve fallire
        }),
      ).rejects.toThrow();
    } finally {
      await fresh.teardown();
    }
  });

  it('rieseguita aggiorna sul posto, non duplica', async () => {
    const before = await testDb.db.select().from(schema.menuItems);
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(menusStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(5);

    const after = await testDb.db.select().from(schema.menuItems);
    expect(after).toHaveLength(5);
    expect(new Set(after.map((i) => i.id))).toEqual(new Set(before.map((i) => i.id)));

    const idMapMenu = await testDb.db.select().from(schema.importIdMap).where(eq(schema.importIdMap.entity, 'menu'));
    expect(idMapMenu).toHaveLength(1);
    const idMapItems = await testDb.db.select().from(schema.importIdMap).where(eq(schema.importIdMap.entity, 'menu_item'));
    expect(idMapItems).toHaveLength(5);
  });

  it('un elemento sintetico corrotto (custom senza url) produce un errore e non ferma la fase', async () => {
    const fresh = await createTestDatabase('amoris_importer_menus_isolation');
    try {
      await seedContentPage(fresh.db);
      const brokenId = 600;
      const brokenPost: SqlRow = { ID: brokenId, post_type: 'nav_menu_item', post_title: 'Rotta', menu_order: 5, post_status: 'publish' };

      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(menusStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: fakeSourceReader({
          wp_terms: WP_TERMS,
          wp_term_taxonomy: WP_TERM_TAXONOMY,
          wp_posts: [...WP_POSTS, brokenPost],
          wp_postmeta: [...WP_POSTMETA, postmeta(brokenId, '_menu_item_type', 'custom')],
          wp_term_relationships: [...WP_TERM_RELATIONSHIPS, menuRelationship(brokenId)],
        }),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(5);
      expect(result.errors).toBe(1);

      const failure = issues.collected.find((i) => i.code === 'item-import-failed' && i.sourceId === brokenId);
      expect(failure).toBeDefined();
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_menus_plan');
    try {
      await seedContentPage(fresh.db);
      const runId = randomUUID();
      const issues = createIssueSink(fresh.db, 'plan', runId);
      const result = await runStage(menusStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId,
        mode: 'plan',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(5);

      const menus = await fresh.db.select().from(schema.menus);
      expect(menus).toHaveLength(0);
      const items = await fresh.db.select().from(schema.menuItems);
      expect(items).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });
});
