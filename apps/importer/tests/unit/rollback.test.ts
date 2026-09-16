/**
 * `rollback --run <id>` (`importer-spec.md` §9, `IMPORTER-DESIGN.md` §7),
 * wave `1D-W5c`.
 *
 * Il criterio di uscita 8 di `importer-spec.md` §14 chiede che `rollback`
 * riporti il database allo stato precedente, **dimostrato**. Qui si dimostra
 * con la fotografia strutturale di `verify/stateDigest.ts`: si fotografa lo
 * stato, si simula un'esecuzione che crea entità, si annulla, si rifotografa,
 * e le due fotografie devono coincidere.
 *
 * Dati sintetici (DR-010): nomi di fantasia, un dominio di esempio, nessun
 * dato reale nemmeno somigliante.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema, type Database } from '@amoris/db';
import {
  applyRollback,
  canProceed,
  planRollback,
} from '../../src/rollback/index.js';
import { createRun, finishRun } from '../../src/persistence/importRuns.js';
import { createIdMap } from '../../src/persistence/idMap.js';
import { buildStubReport } from '../../src/report/build.js';
import { diffStateDigests, stateDigest } from '../../src/verify/stateDigest.js';
import { createTestDatabase, type TestDatabase } from './_support/dbHarness.js';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase('rollback');
});

afterEach(async () => {
  await database.teardown();
});

async function newRun(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

async function closeRun(db: Database, runId: string): Promise<void> {
  await finishRun(
    db,
    runId,
    'success',
    buildStubReport({ runId, mode: 'apply', importerVersion: '0.0.0-test' }),
  );
}

/**
 * Crea la stessa forma di dati che le fasi producono — contenuto padre e
 * figlio, termine, media, form con una compilazione — e la registra in
 * `import_id_map` esattamente come fanno loro, con `runId` e `action`.
 */
async function simulaEsecuzione(
  db: Database,
  runId: string,
  seme: number,
): Promise<{ padreId: string; figlioId: string; formId: string }> {
  const ids = createIdMap();

  return db.transaction(async (tx) => {
    const [media] = await tx
      .insert(schema.media)
      .values({
        storageKey: `2020/01/immagine-${seme}.jpg`,
        publicPath: `/media/2020/01/immagine-${seme}.jpg`,
        fileName: `immagine-${seme}.jpg`,
        mimeType: 'image/jpeg',
        byteSize: 1024,
        checksum: Buffer.from('00'.repeat(32), 'hex'),
        uploadedAt: new Date('2020-01-01T00:00:00Z'),
        legacyId: 900 + seme,
      })
      .returning({ id: schema.media.id });
    await ids.remember(tx, 'wp_posts', 900 + seme, 'media', media!.id, runId, 'created');

    const [termine] = await tx
      .insert(schema.terms)
      .values({
        taxonomy: 'category',
        slug: `argomento-${seme}`,
        name: 'Argomento di prova',
        path: `/argomento-${seme}/`,
        legacyId: 800 + seme,
      })
      .returning({ id: schema.terms.id });
    await ids.remember(tx, 'wp_terms', 800 + seme, 'term', termine!.id, runId, 'created');

    const [padre] = await tx
      .insert(schema.contents)
      .values({
        type: 'page',
        status: 'published',
        slug: `genitore-${seme}`,
        path: `/genitore-${seme}/`,
        title: 'Pagina genitore',
        legacyId: 500 + seme,
        publishedAt: new Date('2020-01-01T00:00:00Z'),
      })
      .returning({ id: schema.contents.id });
    await ids.remember(tx, 'wp_posts', 500 + seme, 'content', padre!.id, runId, 'created');

    const [figlio] = await tx
      .insert(schema.contents)
      .values({
        type: 'page',
        status: 'published',
        slug: `figlio-${seme}`,
        path: `/genitore-${seme}/figlio-${seme}/`,
        title: 'Pagina figlia',
        parentId: padre!.id,
        legacyId: 501 + seme,
        publishedAt: new Date('2020-01-01T00:00:00Z'),
      })
      .returning({ id: schema.contents.id });
    await ids.remember(tx, 'wp_posts', 501 + seme, 'content', figlio!.id, runId, 'created');

    const [form] = await tx
      .insert(schema.forms)
      .values({
        slug: `modulo-${seme}`,
        title: 'Modulo di prova',
        definition: { fields: [] },
        legacyId: 700 + seme,
      })
      .returning({ id: schema.forms.id });
    await ids.remember(tx, 'wp_posts', 700 + seme, 'form', form!.id, runId, 'created');

    // Una compilazione: `form_submissions.formId` è `restrict`, quindi se
    // `rollback` non la cancella prima del form, fallisce.
    await tx.insert(schema.formSubmissions).values({
      formId: form!.id,
      submittedAt: new Date('2020-02-02T00:00:00Z'),
      origin: 'migration',
      payload: { campo: 'valore sintetico' },
      legacyId: 600 + seme,
    });

    await tx.insert(schema.redirects).values({
      sourcePath: `/vecchio-${seme}/`,
      targetPath: `/genitore-${seme}/`,
      origin: 'migration',
    });

    return { padreId: padre!.id, figlioId: figlio!.id, formId: form!.id };
  });
}

describe('rollback', () => {
  it("riporta il database allo stato precedente, dimostrato con la fotografia (§14 punto 8)", async () => {
    const db = database.db;
    const prima = await stateDigest(db);

    const runId = await newRun(db);
    await simulaEsecuzione(db, runId, 1);
    await closeRun(db, runId);

    const dopoImport = await stateDigest(db);
    expect(diffStateDigests(prima, dopoImport).length).toBeGreaterThan(0);

    const plan = await planRollback(db, runId);
    expect(canProceed(plan)).toBe(true);
    await applyRollback(db, plan);

    const dopoRollback = await stateDigest(db);
    expect(diffStateDigests(prima, dopoRollback)).toEqual([]);
  });

  it('cancella un genitore anche se ha un figlio, partendo dalle foglie', async () => {
    const db = database.db;
    const runId = await newRun(db);
    const { padreId, figlioId } = await simulaEsecuzione(db, runId, 2);
    await closeRun(db, runId);

    await applyRollback(db, await planRollback(db, runId));

    const rimasti = await db.select({ id: schema.contents.id }).from(schema.contents);
    expect(rimasti.map((r) => r.id)).not.toContain(padreId);
    expect(rimasti.map((r) => r.id)).not.toContain(figlioId);
  });

  it("rifiuta di procedere se un redattore ha modificato un contenuto dopo l'esecuzione (§9)", async () => {
    const db = database.db;
    const runId = await newRun(db);
    const { padreId } = await simulaEsecuzione(db, runId, 3);
    await closeRun(db, runId);

    // Il redattore salva una modifica: una riga di cronologia successiva alla
    // fine dell'esecuzione. È la stessa traccia della protezione in avanti.
    await db.insert(schema.contentRevisions).values({
      contentId: padreId,
      revisionNo: 1,
      title: 'Titolo cambiato a mano',
      blocks: { schema: 1, blocks: [] },
      createdAt: new Date(Date.now() + 60_000),
    });

    const plan = await planRollback(db, runId);
    expect(canProceed(plan)).toBe(false);
    expect(plan.editorialWorkAfter).toContain(padreId);
    await expect(applyRollback(db, plan)).rejects.toThrow();

    // E il contenuto è ancora lì.
    const [rimasto] = await db
      .select({ id: schema.contents.id })
      .from(schema.contents)
      .where(eq(schema.contents.id, padreId));
    expect(rimasto).toBeDefined();
  });

  it("elenca ciò che ha aggiornato senza ripristinarlo, e non lo cancella (§7.1)", async () => {
    const db = database.db;

    // Prima esecuzione: crea.
    const primoRun = await newRun(db);
    const { padreId } = await simulaEsecuzione(db, primoRun, 4);
    await closeRun(db, primoRun);

    // Seconda esecuzione: aggiorna le stesse entità.
    const secondoRun = await newRun(db);
    const ids = createIdMap();
    await db.transaction(async (tx) => {
      await tx
        .update(schema.contents)
        .set({ title: 'Titolo riscritto dalla seconda esecuzione' })
        .where(eq(schema.contents.id, padreId));
      await ids.remember(tx, 'wp_posts', 504, 'content', padreId, secondoRun, 'updated');
    });
    await closeRun(db, secondoRun);

    const plan = await planRollback(db, secondoRun);
    expect(plan.toDelete).toEqual([]);
    expect(plan.updatedNotRestored).toEqual([{ entity: 'content', count: 1 }]);

    await applyRollback(db, plan);

    // L'entità aggiornata è ancora lì: `rollback` non la cancella, e non la
    // riporta al valore di prima. È il limite dichiarato di §7.1.
    const [rimasto] = await db
      .select({ title: schema.contents.title })
      .from(schema.contents)
      .where(eq(schema.contents.id, padreId));
    expect(rimasto?.title).toBe('Titolo riscritto dalla seconda esecuzione');

    // E le tabelle che non passano dalla mappa — redirect `migration`,
    // `legacy_*` — restano come la prima esecuzione le ha lasciate: annullare
    // un'esecuzione che non ha creato nulla non deve svuotarle.
    const redirect = await db.select({ id: schema.redirects.id }).from(schema.redirects);
    expect(redirect).toHaveLength(1);
  });

  it('non tocca i redirect creati a mano (§9)', async () => {
    const db = database.db;
    await db.insert(schema.redirects).values({
      sourcePath: '/scritto-a-mano/',
      targetPath: '/destinazione/',
      origin: 'manual',
    });

    const runId = await newRun(db);
    await simulaEsecuzione(db, runId, 5);
    await closeRun(db, runId);

    await applyRollback(db, await planRollback(db, runId));

    const rimasti = await db
      .select({ sourcePath: schema.redirects.sourcePath, origin: schema.redirects.origin })
      .from(schema.redirects);
    expect(rimasti).toEqual([{ sourcePath: '/scritto-a-mano/', origin: 'manual' }]);
  });

  it("non tocca il registro dell'esecuzione: ciò che è accaduto resta scritto (§9)", async () => {
    const db = database.db;
    const runId = await newRun(db);
    await simulaEsecuzione(db, runId, 6);
    await closeRun(db, runId);

    await applyRollback(db, await planRollback(db, runId));

    const [run] = await db
      .select({ id: schema.importRuns.id, outcome: schema.importRuns.outcome })
      .from(schema.importRuns)
      .where(eq(schema.importRuns.id, runId));
    expect(run?.outcome).toBe('success');
  });

  it("rifiuta di annullare un'esecuzione superata da una successiva (§11.15)", async () => {
    const db = database.db;

    const primoRun = await newRun(db);
    await simulaEsecuzione(db, primoRun, 7);
    await closeRun(db, primoRun);

    // Una seconda esecuzione sovrascrive la traccia della prima in
    // `import_id_map`: la chiave è unica per entità.
    const secondoRun = await newRun(db);
    await db.transaction(async (tx) => {
      const ids = createIdMap();
      const [contenuto] = await tx
        .select({ id: schema.contents.id })
        .from(schema.contents)
        .limit(1);
      await ids.remember(tx, 'wp_posts', 507, 'content', contenuto!.id, secondoRun, 'updated');
    });
    await closeRun(db, secondoRun);

    const piano = await planRollback(db, primoRun);
    expect(piano.supersededBy).toBe(secondoRun);
    expect(canProceed(piano)).toBe(false);
    await expect(applyRollback(db, piano)).rejects.toThrow();

    // La più recente, invece, si annulla.
    expect(canProceed(await planRollback(db, secondoRun))).toBe(true);
  });

  it("su un'esecuzione che non esiste non fa nulla e lo dice", async () => {
    const plan = await planRollback(database.db, randomUUID());
    expect(plan.runExists).toBe(false);
    expect(canProceed(plan)).toBe(false);
  });
});
