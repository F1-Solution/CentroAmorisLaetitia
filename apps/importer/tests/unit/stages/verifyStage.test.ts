import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import type { Tx } from '../../../src/persistence/tx.js';
import type { SourceReader } from '../../../src/source/index.js';
import { verifyStage } from '../../../src/stages/verify/index.js';
import { contentsStage } from '../../../src/stages/contents/index.js';
import { relationsStage } from '../../../src/stages/relations/index.js';
import {
  checkChecksumMismatches,
  checkContentsWithoutPath,
  checkFilesVsExpected,
  checkMenuItemsDangling,
  checkMetaKeysUnclassified,
  checkRedirectsTo404,
  checkUploadsReferencesRemaining,
} from '../../../src/stages/verify/checks.js';
import { measureTableCounts } from '../../../src/stages/verify/tableCounts.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createIdMap } from '../../../src/persistence/idMap.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { ObjectStore } from '../../../src/storage/objectStore.js';
import { createMediaSourceFixture } from '../_support/mediaFixtures.js';
import { checksumFile } from '../../../src/source/files/uploads.js';
import type { SqlRow } from '../../../src/source/sql/types.js';
import { eq } from 'drizzle-orm';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

const OPTIONS = { only: null, forceContentIds: [] as readonly string[], verbose: false };

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_verify');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('verifiche singole', () => {
  it('checkUploadsReferencesRemaining trova un riferimento rimasto in contents', async () => {
    await testDb.db.insert(schema.contents).values({
      type: 'page',
      status: 'published',
      slug: 'con-residuo',
      path: '/con-residuo/',
      title: 'Con residuo',
      legacyId: 2000,
      publishedAt: new Date(),
      contentHtml: '<img src="/wp-content/uploads/2020/01/foto.jpg">',
    });

    const result = await testDb.db.transaction((tx) => checkUploadsReferencesRemaining(ctxFor(tx)));
    expect(result.value).toBeGreaterThanOrEqual(1);
    expect(result.ok).toBe(false);
    expect(result.executed).toBe(true);
  });

  it('checkContentsWithoutPath riconosce il percorso provvisorio', async () => {
    await testDb.db.insert(schema.contents).values({
      type: 'page',
      status: 'draft',
      slug: 'provvisorio',
      path: '/provvisorio-2001/',
      title: 'Provvisorio',
      legacyId: 2001,
    });

    const result = await testDb.db.transaction((tx) => checkContentsWithoutPath(ctxFor(tx)));
    expect(result.value).toBeGreaterThanOrEqual(1);
    expect(result.ok).toBe(false);
  });

  it('checkMetaKeysUnclassified conta solo le chiavi non classificate', async () => {
    const source = fakeSourceReader({
      wp_postmeta: [
        { meta_id: 1, post_id: 1, meta_key: '_wp_attached_file', meta_value: 'x' },
        { meta_id: 2, post_id: 1, meta_key: '_chiave_mai_vista', meta_value: 'y' },
      ] as SqlRow[],
    });
    const result = await testDb.db.transaction((tx) =>
      checkMetaKeysUnclassified(ctxFor(tx, source)),
    );
    expect(result.value).toBe(1);
    expect(result.ok).toBe(false);
  });

  it('checkMenuItemsDangling distingue un link interno valido da uno nel vuoto', async () => {
    await testDb.db.insert(schema.contents).values({
      type: 'page',
      status: 'published',
      slug: 'raggiungibile',
      path: '/raggiungibile/',
      title: 'Raggiungibile',
      legacyId: 2002,
      publishedAt: new Date(),
    });
    const [menu] = await testDb.db
      .insert(schema.menus)
      .values({ key: 'principale', label: 'Principale' })
      .returning({
        id: schema.menus.id,
      });
    await testDb.db.insert(schema.menuItems).values([
      { menuId: menu!.id, kind: 'custom', label: 'Valido', url: '/raggiungibile/', position: 0 },
      {
        menuId: menu!.id,
        kind: 'custom',
        label: 'Nel vuoto',
        url: '/non-esiste-da-nessuna-parte/',
        position: 1,
      },
    ]);

    const result = await testDb.db.transaction((tx) => checkMenuItemsDangling(ctxFor(tx)));
    expect(result.value).toBe(1);
  });

  it('checkRedirectsTo404 trova una regola exact la cui destinazione non esiste', async () => {
    await testDb.db.insert(schema.redirects).values({
      sourcePath: '/vecchio/',
      targetPath: '/non-esiste-nemmeno-questa/',
      kind: 'exact',
      origin: 'migration',
    });

    const result = await testDb.db.transaction((tx) => checkRedirectsTo404(ctxFor(tx)));
    expect(result.value).toBeGreaterThanOrEqual(1);
  });

  it('measureTableCounts confronta il volume reale con la costante attesa', async () => {
    await testDb.db
      .insert(schema.users)
      .values({ email: 'chi@example.test', fullName: 'Persona di prova' });

    const results = await testDb.db.transaction((tx) => measureTableCounts(ctxFor(tx)));
    const usersRow = results.find((r) => r.table === 'users')!;
    expect(usersRow.value).toBe(1);
    expect(usersRow.expected).toBe(1);
    expect(usersRow.ok).toBe(true);

    const termsRow = results.find((r) => r.table === 'terms')!;
    expect(termsRow.expected).toBe(4);
    expect(termsRow.ok).toBe(termsRow.value === 4);
  });
});

/**
 * DR-063 e DR-064 fino alla verifica: un articolo che condivide lo slug con
 * una pagina e una bozza senza slug, dati sintetici con la forma dei casi reali.
 */
function anomalousPost(id: number, type: 'page' | 'post', slug: string, status: string): SqlRow {
  return {
    ID: id,
    post_author: 0,
    post_title: `Contenuto ${id}`,
    post_content: '<p>Testo sintetico.</p>',
    post_excerpt: '',
    post_status: status,
    post_name: slug,
    post_type: type,
    post_date: `2020-03-0${id % 7} 09:00:00`,
    post_parent: 0,
    menu_order: 0,
  };
}

function anomalousSource(): SourceReader {
  return fakeSourceReader({
    wp_posts: [
      anomalousPost(328, 'page', 'omonimo', 'publish'),
      anomalousPost(332, 'post', 'omonimo', 'publish'),
      anomalousPost(1781, 'post', '', 'draft'),
    ],
    wp_postmeta: [],
    wp_term_relationships: [],
    wp_term_taxonomy: [],
  });
}

async function importAnomalies(db: Database): Promise<void> {
  for (const stage of [contentsStage, relationsStage]) {
    const runId = await newApplyRunId(db);
    const result = await runStage(stage, {
      db,
      storage: fakeObjectStore(),
      source: anomalousSource(),
      runId,
      mode: 'apply',
      issues: createIssueSink(db, 'apply', runId),
      options: OPTIONS,
    });
    expect(result.errors).toBe(0);
  }
}

describe('verifica dei contenuti senza percorso — DR-063, DR-064', () => {
  it('non conta i due contenuti che restano al percorso provvisorio per decisione', async () => {
    const fresh = await createTestDatabase('amoris_importer_verify_provisional_ok');
    try {
      await importAnomalies(fresh.db);

      const result = await fresh.db.transaction((tx) =>
        checkContentsWithoutPath(ctxFor(tx, anomalousSource())),
      );
      expect(result.value).toBe(0);
      expect(result.ok).toBe(true);
    } finally {
      await fresh.teardown();
    }
  });

  it('conta un contenuto rimasto al percorso provvisorio senza motivo', async () => {
    const fresh = await createTestDatabase('amoris_importer_verify_provisional_ko');
    try {
      await importAnomalies(fresh.db);
      // La pagina ha diritto a `/omonimo/`: al percorso provvisorio è un difetto.
      await fresh.db
        .update(schema.contents)
        .set({ path: '/omonimo-328/' })
        .where(eq(schema.contents.legacyId, 328));

      const result = await fresh.db.transaction((tx) =>
        checkContentsWithoutPath(ctxFor(tx, anomalousSource())),
      );
      expect(result.value).toBe(1);
      expect(result.ok).toBe(false);
    } finally {
      await fresh.teardown();
    }
  });
});

const PUBLIC_KEYS = ['2020/05/foto-pubblica.jpg', '2020/05/foto-pubblica-300x200.jpg'];
const PRIVATE_KEYS = ['2020/05/foto-riservata.jpg', '2020/05/foto-riservata-300x200.jpg'];

/** Un allegato con una sua misura derivata: due chiavi attese nello stesso bucket. */
async function seedMediaWithVariant(db: Database, isPrivate: boolean): Promise<void> {
  const [originalKey, variantKey] = isPrivate ? PRIVATE_KEYS : PUBLIC_KEYS;
  const [media] = await db
    .insert(schema.media)
    .values({
      storageKey: originalKey!,
      publicPath: `/media/${originalKey}`,
      fileName: 'foto.jpg',
      mimeType: 'image/jpeg',
      byteSize: 9,
      checksum: Buffer.alloc(32),
      isPrivate,
      uploadedAt: new Date(),
    })
    .returning({ id: schema.media.id });
  await db.insert(schema.mediaVariants).values({
    mediaId: media!.id,
    storageKey: variantKey!,
    publicPath: `/media/${variantKey}`,
    width: 300,
    height: 200,
    byteSize: 9,
    checksum: Buffer.alloc(32),
  });
}

function ctxWith(tx: Tx, mode: 'plan' | 'apply', storage: ObjectStore, verifyOnly = false) {
  return { ...ctxFor(tx), mode, storage, verifyOnly };
}

describe('verifica dei file nel bucket — DR-088, DR-092', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase('amoris_importer_verify_bucket');
    await seedMediaWithVariant(db.db, false);
    await seedMediaWithVariant(db.db, true);
  });

  afterAll(async () => {
    await db.teardown();
  });

  const allPresent = { public: PUBLIC_KEYS, private: PRIVATE_KEYS };

  it('nel plan completo non è eseguita: il bucket non è stato scritto', async () => {
    const storage = fakeObjectStore({ extraKeys: allPresent });
    const result = await db.db.transaction((tx) =>
      checkFilesVsExpected(ctxWith(tx, 'plan', storage)),
    );
    expect(result.executed).toBe(false);
    expect(result.ok).toBe(false);
  });

  it('in apply, con originali e misure derivate presenti, è superata', async () => {
    const storage = fakeObjectStore({ extraKeys: allPresent });
    const result = await db.db.transaction((tx) =>
      checkFilesVsExpected(ctxWith(tx, 'apply', storage)),
    );
    expect(result).toMatchObject({ value: 0, ok: true, executed: true });
  });

  it('in importer verify (plan sulla sola fase verify) è eseguita e conta il file mancante', async () => {
    const storage = fakeObjectStore({
      extraKeys: { public: [PUBLIC_KEYS[0]!], private: PRIVATE_KEYS },
    });
    const result = await db.db.transaction((tx) =>
      checkFilesVsExpected(ctxWith(tx, 'plan', storage, true)),
    );
    expect(result).toMatchObject({ value: 1, ok: false, executed: true });
  });

  it('cerca i file di un allegato riservato nel bucket riservato, non in quello pubblico', async () => {
    const storage = fakeObjectStore({
      extraKeys: { public: [...PUBLIC_KEYS, ...PRIVATE_KEYS], private: [] },
    });
    const result = await db.db.transaction((tx) =>
      checkFilesVsExpected(ctxWith(tx, 'apply', storage)),
    );
    expect(result.value).toBe(2);
  });

  it('con l’archiviazione irraggiungibile non è eseguita, e non interrompe la fase', async () => {
    const storage = fakeObjectStore({ failList: true });
    const result = await db.db.transaction((tx) =>
      checkFilesVsExpected(ctxWith(tx, 'apply', storage)),
    );
    expect(result.executed).toBe(false);
    expect(result.ok).toBe(false);
  });

  it('un oggetto in più nel bucket, come quelli del seme sintetico, non la fa fallire (DR-092)', async () => {
    const storage = fakeObjectStore({
      extraKeys: { public: [...PUBLIC_KEYS, 'seme/oggetto-sintetico.jpg'], private: PRIVATE_KEYS },
    });
    const result = await db.db.transaction((tx) =>
      checkFilesVsExpected(ctxWith(tx, 'apply', storage)),
    );
    expect(result).toMatchObject({ value: 0, ok: true });
  });
});

describe('verifica dei checksum', () => {
  it('DR-065: ritrova il file che sul disco ha maiuscole diverse dalla chiave archiviata', async () => {
    const fresh = await createTestDatabase('amoris_importer_verify_checksum_case');
    const fixture = await createMediaSourceFixture({});
    try {
      await fixture.writeUploadedFile('2020/05/Foto-Verifica.JPG', 'contenuto');
      const hex = await checksumFile(`${fixture.uploadsPath}/2020/05/Foto-Verifica.JPG`);
      await fresh.db.insert(schema.media).values({
        storageKey: '2020/05/foto-verifica.jpg',
        publicPath: '/media/2020/05/foto-verifica.jpg',
        fileName: 'foto-verifica.jpg',
        mimeType: 'image/jpeg',
        byteSize: 9,
        checksum: Buffer.from(hex, 'hex'),
        isPrivate: false,
        uploadedAt: new Date(),
      });

      const result = await fresh.db.transaction((tx) =>
        checkChecksumMismatches(ctxFor(tx, fixture.source)),
      );
      expect(result.value).toBe(0);
      expect(result.ok).toBe(true);
    } finally {
      await fixture.teardown();
      await fresh.teardown();
    }
  });
});

describe('fase verify', () => {
  it('un conteggio che non coincide diventa un errore della fase, non un successo silenzioso', async () => {
    const fresh = await createTestDatabase('amoris_importer_verify_stage');
    try {
      // Nessuna riga in nessuna tabella: ogni volume di tabella non
      // coincide con `EXPECTED_TABLE_COUNTS`, tranne `media_variants` (una
      // stima, non un'uguaglianza) che qui non è nemmeno confrontato.
      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      // Archiviazione irraggiungibile: la verifica del bucket non si può dimostrare.
      const result = await runStage(verifyStage, {
        db: fresh.db,
        storage: fakeObjectStore({ failList: true }),
        source: fakeSourceReader({}),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.errors).toBeGreaterThan(0);
      const mismatches = issues.collected.filter((i) => i.code === 'table-count-mismatch');
      expect(mismatches.length).toBeGreaterThan(0);

      const notExecuted = issues.collected.filter(
        (i) => i.code === 'verification-check-not-executed',
      );
      expect(notExecuted.some((i) => i.detail === 'files-vs-expected')).toBe(true);
      expect(result.skipped).toBeGreaterThan(0);
    } finally {
      await fresh.teardown();
    }
  });
});

function ctxFor(tx: Tx, source: SourceReader = fakeSourceReader({})) {
  return {
    runId: 'test-run',
    mode: 'apply' as const,
    source,
    tx,
    storage: fakeObjectStore(),
    ids: createIdMap(),
    issues: createIssueSink(undefined as unknown as Database, 'plan', 'test-run'),
    options: OPTIONS,
    ipHashSalt: null, // `verify` non calcola digest
  };
}
