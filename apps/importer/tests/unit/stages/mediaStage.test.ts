import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { mediaStage } from '../../../src/stages/media/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import { createMediaSourceFixture, serializedAttachmentMetadata } from '../_support/mediaFixtures.js';
import type { SqlRow } from '../../../src/source/sql/types.js';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, { isDryRun: false, sourceLabel: 'BackupDB-2026-09-13', importerVersion: '0.0.0-test' });
}

const OPTIONS = { only: null, forceContentIds: [], verbose: false } as const;

/**
 * Un solo allegato sintetico, con una dimensione derivata (DR-010: nomi di
 * fantasia). `id`, `attachedFile` e `variantFile` sono parametrizzati: i test
 * condividono `testDb` (come `usersStage.test.ts`, `settingsStage.test.ts`),
 * e ognuno che pretende una situazione di partenza pulita usa un
 * identificatore e un percorso propri, per non collidere con le righe che i
 * test precedenti nello stesso file hanno lasciato.
 */
function buildOneAttachmentRows(options: {
  id: number;
  attachedFile: string;
  variantFile: string;
}): { wp_posts: SqlRow[]; wp_postmeta: SqlRow[] } {
  const { id, attachedFile, variantFile } = options;
  const wp_posts: SqlRow[] = [
    {
      ID: id,
      post_type: 'attachment',
      post_title: 'Locandina di prova',
      post_excerpt: 'Una didascalia di prova',
      post_mime_type: 'image/jpeg',
      post_date: '2020-05-10 09:00:00',
      post_author: 1,
    },
  ];
  const wp_postmeta: SqlRow[] = [
    { meta_id: id * 10 + 1, post_id: id, meta_key: '_wp_attached_file', meta_value: attachedFile },
    {
      meta_id: id * 10 + 2,
      post_id: id,
      meta_key: '_wp_attachment_metadata',
      meta_value: serializedAttachmentMetadata({
        width: 800,
        height: 600,
        variantFile,
        variantWidth: 150,
        variantHeight: 150,
        variantMimeType: 'image/jpeg',
      }),
    },
    { meta_id: id * 10 + 3, post_id: id, meta_key: '_wp_attachment_image_alt', meta_value: 'testo alternativo di prova' },
  ];
  return { wp_posts, wp_postmeta };
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_media');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase media', () => {
  it('crea la riga media e media_variants, e carica il file nel bucket pubblico prima delle righe', async () => {
    const fixture = await createMediaSourceFixture(
      buildOneAttachmentRows({
        id: 501,
        attachedFile: '2020/05/foto-prova.jpg',
        variantFile: 'foto-prova-150x150.jpg',
      }),
    );
    try {
      await fixture.writeUploadedFile('2020/05/foto-prova.jpg', 'contenuto della foto di prova');
      await fixture.writeUploadedFile('2020/05/foto-prova-150x150.jpg', 'contenuto della miniatura');

      const runId = await newApplyRunId(testDb.db);
      const issues = createIssueSink(testDb.db, 'apply', runId);
      const storage = fakeObjectStore();

      const result = await runStage(mediaStage, {
        db: testDb.db,
        source: fixture.source,
        storage,
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(1);
      expect(result.errors).toBe(0);

      // Il file è entrato nel bucket: entrambi gli oggetti, pubblici.
      expect(storage.puts).toHaveLength(2);
      expect(storage.puts.every((p) => p.bucket === 'public')).toBe(true);
      expect(storage.puts.map((p) => p.key).sort()).toEqual(
        ['2020/05/foto-prova-150x150.jpg', '2020/05/foto-prova.jpg'].sort(),
      );

      const [media] = await testDb.db.select().from(schema.media).where(eq(schema.media.legacyId, 501));
      expect(media).toBeDefined();
      expect(media?.storageKey).toBe('2020/05/foto-prova.jpg');
      expect(media?.publicPath).toBe('/media/2020/05/foto-prova.jpg');
      expect(media?.width).toBe(800);
      expect(media?.height).toBe(600);
      expect(media?.altText).toBe('testo alternativo di prova');
      expect(media?.caption).toBe('Una didascalia di prova');
      expect(media?.isPrivate).toBe(false);

      const variants = await testDb.db
        .select()
        .from(schema.mediaVariants)
        .where(eq(schema.mediaVariants.mediaId, media!.id));
      expect(variants).toHaveLength(1);
      expect(variants[0]?.publicPath).toBe('/media/2020/05/foto-prova-150x150.jpg');
      expect(variants[0]?.width).toBe(150);
      expect(variants[0]?.height).toBe(150);

      const idMapRow = await ctxIdMapRow(testDb.db, 501);
      expect(idMapRow?.entityId).toBe(media!.id);
    } finally {
      await fixture.teardown();
    }
  });

  it('alla riesecuzione con lo stesso checksum non ricarica il file, ma aggiorna la riga', async () => {
    const fixture = await createMediaSourceFixture(
      buildOneAttachmentRows({
        id: 511,
        attachedFile: '2020/05/foto-stabile.jpg',
        variantFile: 'foto-stabile-150x150.jpg',
      }),
    );
    try {
      await fixture.writeUploadedFile('2020/05/foto-stabile.jpg', 'contenuto stabile');
      await fixture.writeUploadedFile('2020/05/foto-stabile-150x150.jpg', 'miniatura stabile');
      const storage = fakeObjectStore();

      const runId1 = await newApplyRunId(testDb.db);
      const first = await runStage(mediaStage, {
        db: testDb.db,
        source: fixture.source,
        storage,
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(testDb.db, 'apply', runId1),
        options: OPTIONS,
      });
      expect(first.created).toBe(1);
      expect(storage.puts).toHaveLength(2);

      const runId2 = await newApplyRunId(testDb.db);
      const second = await runStage(mediaStage, {
        db: testDb.db,
        source: fixture.source,
        storage,
        runId: runId2,
        mode: 'apply',
        issues: createIssueSink(testDb.db, 'apply', runId2),
        options: OPTIONS,
      });
      expect(second.created).toBe(0);
      expect(second.updated).toBe(1);
      // Stesso checksum: nessuna nuova chiamata al bucket.
      expect(storage.puts).toHaveLength(2);
    } finally {
      await fixture.teardown();
    }
  });

  it('quando il checksum cambia, ricarica il file', async () => {
    const fixture = await createMediaSourceFixture(
      buildOneAttachmentRows({
        id: 521,
        attachedFile: '2020/05/foto-cambia.jpg',
        variantFile: 'foto-cambia-150x150.jpg',
      }),
    );
    try {
      await fixture.writeUploadedFile('2020/05/foto-cambia.jpg', 'versione uno');
      await fixture.writeUploadedFile('2020/05/foto-cambia-150x150.jpg', 'miniatura uno');
      const storage = fakeObjectStore();

      const runId1 = await newApplyRunId(testDb.db);
      await runStage(mediaStage, {
        db: testDb.db,
        source: fixture.source,
        storage,
        runId: runId1,
        mode: 'apply',
        issues: createIssueSink(testDb.db, 'apply', runId1),
        options: OPTIONS,
      });
      expect(storage.puts).toHaveLength(2);

      // Stesso nome file, contenuto diverso: checksum diverso.
      await fixture.writeUploadedFile('2020/05/foto-cambia.jpg', 'versione due, diversa');

      const runId2 = await newApplyRunId(testDb.db);
      const second = await runStage(mediaStage, {
        db: testDb.db,
        source: fixture.source,
        storage,
        runId: runId2,
        mode: 'apply',
        issues: createIssueSink(testDb.db, 'apply', runId2),
        options: OPTIONS,
      });
      expect(second.updated).toBe(1);
      // Il file originale è stato ricaricato (nuova chiamata), la miniatura no.
      expect(storage.puts).toHaveLength(3);
      expect(storage.puts.at(-1)?.key).toBe('2020/05/foto-cambia.jpg');
    } finally {
      await fixture.teardown();
    }
  });

  it('il file entra nel bucket anche se la riga poi fallisce: recuperabile, non un collegamento rotto', async () => {
    const fixture = await createMediaSourceFixture(
      buildOneAttachmentRows({
        id: 531,
        attachedFile: '2020/05/foto-fallisce.jpg',
        variantFile: 'foto-fallisce-150x150.jpg',
      }),
    );
    try {
      await fixture.writeUploadedFile('2020/05/foto-fallisce.jpg', 'contenuto');
      await fixture.writeUploadedFile('2020/05/foto-fallisce-150x150.jpg', 'miniatura');
      const storage = fakeObjectStore();

      // Un'altra riga occupa già lo stesso public_path: l'inserimento di
      // questo allegato violerà il vincolo di unicità *dopo* il caricamento.
      await testDb.db.insert(schema.media).values({
        storageKey: 'altro/percorso.jpg',
        publicPath: '/media/2020/05/foto-fallisce.jpg',
        fileName: 'altro.jpg',
        mimeType: 'image/jpeg',
        byteSize: 1,
        checksum: Buffer.from('00', 'hex'),
        isPrivate: false,
        uploadedAt: new Date(),
        legacyId: 999999,
      });

      const runId = await newApplyRunId(testDb.db);
      const issues = createIssueSink(testDb.db, 'apply', runId);
      const result = await runStage(mediaStage, {
        db: testDb.db,
        source: fixture.source,
        storage,
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.errors).toBe(1);
      expect(result.created).toBe(0);
      // Il caricamento è avvenuto comunque: la scrittura nel bucket precede
      // l'inserimento della riga, e non fa parte della transazione del
      // database che qui viene annullata (savepoint).
      expect(storage.puts.some((p) => p.key === '2020/05/foto-fallisce.jpg')).toBe(true);

      const failure = issues.collected.find((i) => i.code === 'item-import-failed');
      expect(failure).toBeDefined();
      expect(failure?.sourceTable).toBe('wp_posts');
      expect(failure?.sourceId).toBe(531);

      // La riga preesistente non è stata toccata dal savepoint annullato.
      const [preexisting] = await testDb.db.select().from(schema.media).where(eq(schema.media.legacyId, 999999));
      expect(preexisting?.publicPath).toBe('/media/2020/05/foto-fallisce.jpg');

      await testDb.db.delete(schema.media).where(eq(schema.media.legacyId, 999999));
    } finally {
      await fixture.teardown();
    }
  });

  it('un allegato con il file mancante produce un errore isolato, gli altri proseguono', async () => {
    const rows = buildOneAttachmentRows({
      id: 541,
      attachedFile: '2020/05/foto-quinto.jpg',
      variantFile: 'foto-quinto-150x150.jpg',
    });
    rows.wp_posts.push({
      ID: 542,
      post_type: 'attachment',
      post_title: 'Allegato senza file',
      post_excerpt: '',
      post_mime_type: 'image/png',
      post_date: '2020-06-01 09:00:00',
      post_author: 1,
    });
    rows.wp_postmeta.push({
      meta_id: 5420,
      post_id: 542,
      meta_key: '_wp_attached_file',
      meta_value: '2020/06/non-esiste.png',
    });

    const fixture = await createMediaSourceFixture(rows);
    try {
      await fixture.writeUploadedFile('2020/05/foto-quinto.jpg', 'contenuto');
      await fixture.writeUploadedFile('2020/05/foto-quinto-150x150.jpg', 'miniatura');
      // Nessun file scritto per 2020/06/non-esiste.png.

      const runId = await newApplyRunId(testDb.db);
      const issues = createIssueSink(testDb.db, 'apply', runId);
      const result = await runStage(mediaStage, {
        db: testDb.db,
        source: fixture.source,
        storage: fakeObjectStore(),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(1);
      expect(result.errors).toBe(1);
      const failure = issues.collected.find((i) => i.code === 'item-import-failed' && i.sourceId === 542);
      expect(failure).toBeDefined();
    } finally {
      await fixture.teardown();
    }
  });

  it('una dimensione derivata mancante sul disco produce un avviso, non fa fallire l’allegato', async () => {
    const rows = buildOneAttachmentRows({
      id: 551,
      attachedFile: '2020/05/foto-senza-derivata.jpg',
      variantFile: 'foto-senza-derivata-150x150.jpg',
    });
    const fixture = await createMediaSourceFixture(rows);
    try {
      await fixture.writeUploadedFile('2020/05/foto-senza-derivata.jpg', 'contenuto');
      // La miniatura NON viene scritta: la metadata la referenzia comunque.

      const runId = await newApplyRunId(testDb.db);
      const issues = createIssueSink(testDb.db, 'apply', runId);
      const result = await runStage(mediaStage, {
        db: testDb.db,
        source: fixture.source,
        storage: fakeObjectStore(),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(1);
      expect(result.errors).toBe(0);
      const warning = issues.collected.find((i) => i.severity === 'warning' && i.sourceId === 551);
      expect(warning).toBeDefined();

      const [media] = await testDb.db.select().from(schema.media).where(eq(schema.media.legacyId, 551));
      const variants = await testDb.db
        .select()
        .from(schema.mediaVariants)
        .where(eq(schema.mediaVariants.mediaId, media!.id));
      expect(variants).toHaveLength(0);
    } finally {
      await fixture.teardown();
    }
  });

  it('in modo plan non scrive nulla nel database né nel bucket: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_media_plan');
    const fixture = await createMediaSourceFixture(
      buildOneAttachmentRows({
        id: 501,
        attachedFile: '2020/05/foto-prova.jpg',
        variantFile: 'foto-prova-150x150.jpg',
      }),
    );
    try {
      await fixture.writeUploadedFile('2020/05/foto-prova.jpg', 'contenuto');
      await fixture.writeUploadedFile('2020/05/foto-prova-150x150.jpg', 'miniatura');

      const runId = randomUUID();
      const storage = fakeObjectStore();
      const result = await runStage(mediaStage, {
        db: fresh.db,
        source: fixture.source,
        storage,
        runId,
        mode: 'plan',
        issues: createIssueSink(fresh.db, 'plan', runId),
        options: OPTIONS,
      });

      expect(result.created).toBe(1);
      // `plan` non scrive mai nel bucket (importer-spec.md §5.2).
      expect(storage.puts).toHaveLength(0);

      const media = await fresh.db.select().from(schema.media);
      expect(media).toHaveLength(0);
      const idMap = await fresh.db.select().from(schema.importIdMap);
      expect(idMap).toHaveLength(0);
    } finally {
      await fixture.teardown();
      await fresh.teardown();
    }
  });
});

async function ctxIdMapRow(db: Database, legacyId: number) {
  const [row] = await db
    .select()
    .from(schema.importIdMap)
    .where(
      and(
        eq(schema.importIdMap.sourceTable, 'wp_posts'),
        eq(schema.importIdMap.sourceId, legacyId),
        eq(schema.importIdMap.entity, 'media'),
      ),
    );
  return row;
}
