/**
 * Fase `documents` con i due lettori veri (DR-058, DR-060): file sintetici su
 * disco, sia nell'albero `download-manager-files/` (pubblici) sia in un
 * albero riservato temporaneo che imita `customer-area/storage/` (riservati).
 * Nessun nome reale dei moduli del Centro: nomi e contenuti sono di fantasia.
 */
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { documentsStage } from '../../../src/stages/documents/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import { listUploadedFiles } from '../../../src/source/files/uploads.js';
import { listPrivateStorageFiles } from '../../../src/source/files/privateStorage.js';
import type { SourceReader } from '../../../src/source/index.js';
import type { SqlRow } from '../../../src/source/sql/types.js';

const OPTIONS = { only: null, forceContentIds: [] as readonly string[], verbose: false };

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

function documentPost(id: number, postType: 'wpdmpro' | 'cuar_private_file', slug: string): SqlRow {
  return {
    ID: id,
    post_type: postType,
    post_title: `Documento ${id}`,
    post_name: slug,
    post_status: 'publish',
  };
}

function phpString(value: string): string {
  return `s:${Buffer.byteLength(value, 'utf8')}:"${value}";`;
}

/** `__wpdm_files`: `a:1:{i:0;s:N:"nomefile";}` — solo il nome, misurato sulla sorgente. */
function serializeWpdmFiles(fileName: string): string {
  return `a:1:{i:0;${phpString(fileName)}}`;
}

/**
 * `cuar_private_file_file`: `a:1:{s:32:"<id>";a:2:{s:2:"id";s:32:"<id>";s:4:"file";s:N:"nomefile";}}`.
 * Semplificata a due sole chiavi interne (`id`, `file`): il parser legge solo
 * `file`, e il conteggio dichiarato è quello reale di questa fixture.
 */
function serializeCuarPrivateFile(idHex: string, fileName: string): string {
  const inner = `a:2:{${phpString('id')}${phpString(idHex)}${phpString('file')}${phpString(fileName)}}`;
  return `a:1:{${phpString(idHex)}${inner}}`;
}

interface DocumentsFixture {
  readonly source: SourceReader;
  writePublicFile(fileName: string, content: string): Promise<void>;
  writePrivateFile(hash: string, fileName: string, content: string): Promise<void>;
  teardown(): Promise<void>;
}

async function createDocumentsFixture(
  tables: Readonly<Record<string, readonly SqlRow[]>>,
): Promise<DocumentsFixture> {
  const uploadsPath = await mkdtemp(path.join(tmpdir(), 'amoris-importer-docs-uploads-'));
  const privateStoragePath = await mkdtemp(path.join(tmpdir(), 'amoris-importer-docs-private-'));

  const writePublicFile = async (fileName: string, content: string): Promise<void> => {
    const dir = path.join(uploadsPath, 'download-manager-files');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), content, 'utf8');
  };

  const writePrivateFile = async (
    hash: string,
    fileName: string,
    content: string,
  ): Promise<void> => {
    const dir = path.join(privateStoragePath, hash);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), content, 'utf8');
  };

  const source: SourceReader = {
    dumpPath: '/finto/dump.sql',
    uploadsPath,
    privateStoragePath,
    fingerprint: async () => ({ sha256: 'finto', sizeBytes: 0 }),
    dump: async () => ({
      tables: new Map(Object.keys(tables).map((t) => [t, Object.keys(tables[t]?.[0] ?? {})])),
      rows: new Map(Object.entries(tables)),
      issues: [],
    }),
    tableNames: async () => Object.keys(tables),
    rows: async (table: string) => tables[table] ?? [],
    uploadedFiles: () => listUploadedFiles(uploadsPath),
    privateFiles: () => listPrivateStorageFiles(privateStoragePath),
  };

  return {
    source,
    writePublicFile,
    writePrivateFile,
    teardown: async () => {
      await rm(uploadsPath, { recursive: true, force: true });
      await rm(privateStoragePath, { recursive: true, force: true });
    },
  };
}

let testDb: TestDatabase;
let fixture: DocumentsFixture | null = null;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_documents');
});

afterAll(async () => {
  await testDb.teardown();
});

afterEach(async () => {
  await fixture?.teardown();
  fixture = null;
});

describe('fase documents', () => {
  it('un documento riservato risolto scrive documents.isPrivate=true, media.isPrivate=true e carica nel bucket private', async () => {
    fixture = await createDocumentsFixture({
      wp_posts: [documentPost(935, 'cuar_private_file', 'riservato-1')],
      wp_postmeta: [
        {
          post_id: 935,
          meta_key: 'cuar_private_file_file',
          meta_value: serializeCuarPrivateFile('aa11', 'Fantasia-Riservato.pdf'),
        },
      ],
      wp_term_relationships: [],
      wp_term_taxonomy: [],
    });
    await fixture.writePrivateFile(
      'a1b2c3',
      'Fantasia-Riservato.pdf',
      'contenuto sintetico riservato',
    );

    const runId = await newApplyRunId(testDb.db);
    const storage = fakeObjectStore();
    const result = await runStage(documentsStage, {
      db: testDb.db,
      storage,
      source: fixture.source,
      runId,
      mode: 'apply',
      issues: createIssueSink(testDb.db, 'apply', runId),
      options: OPTIONS,
    });

    expect(result.created).toBe(1);

    const [document] = await testDb.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.legacyId, 935));
    expect(document?.isPrivate).toBe(true);

    const [media] = await testDb.db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, document!.mediaId));
    expect(media?.isPrivate).toBe(true);
    expect(media?.storageKey).toBe('customer-area/a1b2c3/Fantasia-Riservato.pdf');

    expect(storage.puts).toHaveLength(1);
    expect(storage.puts[0]?.bucket).toBe('private');
    expect(storage.puts[0]?.key).toBe('customer-area/a1b2c3/Fantasia-Riservato.pdf');
  });

  it('un documento pubblico risolto scrive documents.isPrivate=false, media.isPrivate=false e carica nel bucket public', async () => {
    fixture = await createDocumentsFixture({
      wp_posts: [
        { ...documentPost(959, 'wpdmpro', 'pubblico-1'), post_date_gmt: '2022-04-05 08:30:00' },
      ],
      wp_postmeta: [
        {
          post_id: 959,
          meta_key: '__wpdm_files',
          meta_value: serializeWpdmFiles('Fantasia Pubblico.pdf'),
        },
      ],
      wp_term_relationships: [],
      wp_term_taxonomy: [],
    });
    await fixture.writePublicFile('Fantasia Pubblico.pdf', 'contenuto sintetico pubblico');

    const runId = await newApplyRunId(testDb.db);
    const storage = fakeObjectStore();
    const result = await runStage(documentsStage, {
      db: testDb.db,
      storage,
      source: fixture.source,
      runId,
      mode: 'apply',
      issues: createIssueSink(testDb.db, 'apply', runId),
      options: OPTIONS,
    });

    expect(result.created).toBe(1);

    const [document] = await testDb.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.legacyId, 959));
    expect(document?.isPrivate).toBe(false);
    // DR-144: la data del post, per l'ordine della ricerca del sito pubblico.
    expect(document?.publishedAt?.toISOString()).toBe('2022-04-05T08:30:00.000Z');

    const [media] = await testDb.db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, document!.mediaId));
    expect(media?.isPrivate).toBe(false);
    expect(media?.storageKey).toBe('download-manager-files/Fantasia Pubblico.pdf');

    expect(storage.puts).toHaveLength(1);
    expect(storage.puts[0]?.bucket).toBe('public');
  });

  it('in modo plan non scrive nulla nel bucket', async () => {
    fixture = await createDocumentsFixture({
      wp_posts: [documentPost(960, 'wpdmpro', 'pubblico-plan')],
      wp_postmeta: [
        {
          post_id: 960,
          meta_key: '__wpdm_files',
          meta_value: serializeWpdmFiles('Fantasia Piano.pdf'),
        },
      ],
      wp_term_relationships: [],
      wp_term_taxonomy: [],
    });
    await fixture.writePublicFile('Fantasia Piano.pdf', 'contenuto sintetico piano');

    const fresh = await createTestDatabase('amoris_importer_documents_plan');
    try {
      const runId = randomUUID();
      const storage = fakeObjectStore();
      const result = await runStage(documentsStage, {
        db: fresh.db,
        storage,
        source: fixture.source,
        runId,
        mode: 'plan',
        issues: createIssueSink(fresh.db, 'plan', runId),
        options: OPTIONS,
      });

      expect(result.created).toBe(1);
      expect(storage.puts).toHaveLength(0);
      const rows = await fresh.db.select().from(schema.documents);
      expect(rows).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });

  it('file mancante: warning document-file-unresolved e nessuna riga documents', async () => {
    fixture = await createDocumentsFixture({
      wp_posts: [documentPost(937, 'cuar_private_file', 'riservato-mancante')],
      wp_postmeta: [
        {
          post_id: 937,
          meta_key: 'cuar_private_file_file',
          meta_value: serializeCuarPrivateFile('bb22', 'Fantasia-Introvabile.pdf'),
        },
      ],
      wp_term_relationships: [],
      wp_term_taxonomy: [],
    });
    // Nessun file scritto sotto l'albero riservato: il nome non si trova.

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(documentsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: fixture.source,
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.skipped).toBe(1);
    const rows = await testDb.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.legacyId, 937));
    expect(rows).toHaveLength(0);

    const issue = issues.collected.find((i) => i.sourceId === 937);
    expect(issue?.code).toBe('document-file-unresolved');
    expect(issue?.detail).toBe('private-storage-file-not-found');
  });

  it('stesso nome di file in due cartelle riservate: warning, nessuna scelta arbitraria', async () => {
    fixture = await createDocumentsFixture({
      wp_posts: [documentPost(941, 'cuar_private_file', 'riservato-ambiguo')],
      wp_postmeta: [
        {
          post_id: 941,
          meta_key: 'cuar_private_file_file',
          meta_value: serializeCuarPrivateFile('cc33', 'Fantasia-Duplicato.pdf'),
        },
      ],
      wp_term_relationships: [],
      wp_term_taxonomy: [],
    });
    await fixture.writePrivateFile('hash-uno', 'Fantasia-Duplicato.pdf', 'copia numero uno');
    await fixture.writePrivateFile('hash-due', 'Fantasia-Duplicato.pdf', 'copia numero due');

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(documentsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: fixture.source,
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.skipped).toBe(1);
    const rows = await testDb.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.legacyId, 941));
    expect(rows).toHaveLength(0);

    const issue = issues.collected.find((i) => i.sourceId === 941);
    expect(issue?.code).toBe('document-file-unresolved');
    expect(issue?.detail).toBe('private-storage-file-ambiguous');
  });

  it('estensione fuori dalla mappa MIME chiusa: warning, documento saltato', async () => {
    fixture = await createDocumentsFixture({
      wp_posts: [documentPost(943, 'cuar_private_file', 'riservato-tipo-ignoto')],
      wp_postmeta: [
        {
          post_id: 943,
          meta_key: 'cuar_private_file_file',
          meta_value: serializeCuarPrivateFile('dd44', 'Fantasia-Documento.docx'),
        },
      ],
      wp_term_relationships: [],
      wp_term_taxonomy: [],
    });
    await fixture.writePrivateFile(
      'hash-docx',
      'Fantasia-Documento.docx',
      'contenuto sintetico docx',
    );

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(documentsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: fixture.source,
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.skipped).toBe(1);
    const issue = issues.collected.find((i) => i.sourceId === 943);
    expect(issue?.code).toBe('document-file-unresolved');
    expect(issue?.detail).toBe('document-mime-type-unsupported');
  });

  it('rieseguita aggiorna sul posto: non crea un secondo media', async () => {
    fixture = await createDocumentsFixture({
      wp_posts: [documentPost(962, 'wpdmpro', 'pubblico-rieseguito')],
      wp_postmeta: [
        {
          post_id: 962,
          meta_key: '__wpdm_files',
          meta_value: serializeWpdmFiles('Fantasia Rieseguito.pdf'),
        },
      ],
      wp_term_relationships: [],
      wp_term_taxonomy: [],
    });
    await fixture.writePublicFile('Fantasia Rieseguito.pdf', 'contenuto sintetico rieseguito');

    const runId1 = await newApplyRunId(testDb.db);
    await runStage(documentsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: fixture.source,
      runId: runId1,
      mode: 'apply',
      issues: createIssueSink(testDb.db, 'apply', runId1),
      options: OPTIONS,
    });

    const runId2 = await newApplyRunId(testDb.db);
    const result = await runStage(documentsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: fixture.source,
      runId: runId2,
      mode: 'apply',
      issues: createIssueSink(testDb.db, 'apply', runId2),
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);

    const documentRows = await testDb.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.legacyId, 962));
    expect(documentRows).toHaveLength(1);

    const mediaRows = await testDb.db
      .select()
      .from(schema.media)
      .where(eq(schema.media.legacyId, 962));
    expect(mediaRows).toHaveLength(1);
  });
});
