import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { rewriteStage } from '../../../src/stages/rewrite/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

const OPTIONS = { only: null, forceContentIds: [] as readonly string[], verbose: false };

function buildSource() {
  return fakeSourceReader({});
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_rewrite');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase rewrite', () => {
  it('riscrive tutte le varianti in contents, slider_slides e settings, e azzera i riferimenti residui', async () => {
    const [content] = await testDb.db
      .insert(schema.contents)
      .values({
        type: 'page',
        status: 'published',
        slug: 'con-immagini',
        path: '/con-immagini/',
        title: 'Pagina con immagini',
        legacyId: 1000,
        publishedAt: new Date(),
        blocks: {
          schema: 1,
          blocks: [
            {
              type: 'image',
              src: 'https://www.centroamorislaetitia.it/wp-content/uploads/2020/01/foto.jpg',
              srcset:
                'http://centroamorislaetitia.it/wp-content/uploads/2020/01/foto-150x150.jpg 150w, /wp-content/uploads/2020/01/foto-300x300.jpg 300w',
            },
          ],
        },
        contentHtml:
          '<img src="https://centroamorislaetitia.it/wp-content/uploads/2020/01/foto.jpg" alt="">',
      })
      .returning({ id: schema.contents.id });

    const [slider] = await testDb.db
      .insert(schema.sliders)
      .values({ key: 'home', title: 'Home' })
      .returning({ id: schema.sliders.id });
    await testDb.db.insert(schema.sliderSlides).values({
      sliderId: slider!.id,
      position: 0,
      heading: 'Titolo',
      body: 'Vedi <a href="/wp-content/uploads/2019/06/doc.pdf">qui</a>',
      linkUrl: 'https://www.centroamorislaetitia.it/wp-content/uploads/2019/06/doc.pdf',
      settings: { background: '/wp-content/uploads/2019/06/sfondo.jpg' },
    });

    await testDb.db.insert(schema.settings).values({
      key: 'branding.logo',
      value: { url: 'https://www.centroamorislaetitia.it/wp-content/uploads/2018/01/logo.png' },
      label: 'Logo',
    });

    const runId = await newApplyRunId(testDb.db);
    const result = await runStage(rewriteStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues: createIssueSink(testDb.db, 'apply', runId),
      options: OPTIONS,
    });
    expect(result.errors).toBe(0);
    expect(result.updated).toBe(3);

    const rewrittenContent = (
      await testDb.db.select().from(schema.contents).where(eq(schema.contents.id, content!.id))
    )[0]!;
    expect(JSON.stringify(rewrittenContent.blocks)).not.toMatch(/wp-content\/uploads/i);
    expect(rewrittenContent.contentHtml).toBe('<img src="/media/2020/01/foto.jpg" alt="">');
    const block = (rewrittenContent.blocks as { blocks: { src: string; srcset: string }[] })
      .blocks[0]!;
    expect(block.src).toBe('/media/2020/01/foto.jpg');
    expect(block.srcset).toBe(
      '/media/2020/01/foto-150x150.jpg 150w, /media/2020/01/foto-300x300.jpg 300w',
    );

    const rewrittenSlide = (await testDb.db.select().from(schema.sliderSlides))[0]!;
    expect(rewrittenSlide.body).toBe('Vedi <a href="/media/2019/06/doc.pdf">qui</a>');
    expect(rewrittenSlide.linkUrl).toBe('/media/2019/06/doc.pdf');
    expect((rewrittenSlide.settings as { background: string }).background).toBe(
      '/media/2019/06/sfondo.jpg',
    );

    const rewrittenSetting = (
      await testDb.db.select().from(schema.settings).where(eq(schema.settings.key, 'branding.logo'))
    )[0]!;
    expect((rewrittenSetting.value as { url: string }).url).toBe('/media/2018/01/logo.png');
  });

  it('rieseguita non trova più nulla da riscrivere', async () => {
    const runId = await newApplyRunId(testDb.db);
    const result = await runStage(rewriteStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues: createIssueSink(testDb.db, 'apply', runId),
      options: OPTIONS,
    });
    expect(result.errors).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('fallisce se un riferimento sopravvive alla riscrittura, e non lascia scritture parziali', async () => {
    const fresh = await createTestDatabase('amoris_importer_rewrite_failure');
    try {
      // Senza lo slash finale la regola di sostituzione (che lo richiede) non
      // scatta, ma la sonda di verifica lo trova comunque: è esattamente il
      // caso in cui la fase deve fallire, non avvisare.
      const [content] = await fresh.db
        .insert(schema.contents)
        .values({
          type: 'page',
          status: 'published',
          slug: 'senza-slash',
          path: '/senza-slash/',
          title: 'Senza slash finale',
          legacyId: 1001,
          publishedAt: new Date(),
          contentHtml: 'Vedi https://www.centroamorislaetitia.it/wp-content/uploads',
        })
        .returning({ id: schema.contents.id });

      const runId = await newApplyRunId(fresh.db);
      await expect(
        runStage(rewriteStage, {
          db: fresh.db,
          storage: fakeObjectStore(),
          source: buildSource(),
          runId,
          mode: 'apply',
          issues: createIssueSink(fresh.db, 'apply', runId),
          options: OPTIONS,
        }),
      ).rejects.toThrow();

      const untouched = (
        await fresh.db.select().from(schema.contents).where(eq(schema.contents.id, content!.id))
      )[0]!;
      expect(untouched.contentHtml).toBe(
        'Vedi https://www.centroamorislaetitia.it/wp-content/uploads',
      );
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla', async () => {
    const fresh = await createTestDatabase('amoris_importer_rewrite_plan');
    try {
      await fresh.db.insert(schema.contents).values({
        type: 'page',
        status: 'published',
        slug: 'piano',
        path: '/piano/',
        title: 'Piano',
        legacyId: 1002,
        publishedAt: new Date(),
        contentHtml: '<img src="/wp-content/uploads/2020/01/foto.jpg">',
      });
      const before = (await fresh.db.select().from(schema.contents))[0]!;

      const runId = randomUUID();
      await runStage(rewriteStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId,
        mode: 'plan',
        issues: createIssueSink(fresh.db, 'plan', runId),
        options: OPTIONS,
      });

      const after = (await fresh.db.select().from(schema.contents))[0]!;
      expect(after.contentHtml).toBe(before.contentHtml);
    } finally {
      await fresh.teardown();
    }
  });
});
