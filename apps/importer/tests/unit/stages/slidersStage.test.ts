import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Database } from '@amoris/db';
import { slidersStage } from '../../../src/stages/sliders/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

const OPTIONS = { only: null, forceContentIds: [] as readonly string[], verbose: false };

const SLIDER_ROWS: readonly SqlRow[] = [
  {
    id: 1,
    title: 'Slider home',
    alias: 'home',
    params: JSON.stringify({
      general: { fullWidth: 'on' },
      nav: { arrows: 'on' },
      addOns: {},
      version: '6.5.0',
    }),
    settings: JSON.stringify({ version: '6.5.0' }),
    type: 'standard',
  },
];

function slideRow(
  id: number,
  order: number,
  params: Record<string, unknown>,
  layers: unknown,
): SqlRow {
  return {
    id,
    slider_id: 1,
    slide_order: order,
    params: JSON.stringify(params),
    layers: JSON.stringify(layers),
  };
}

const RESOLVABLE_IMAGE_URL = 'https://esempio.test/wp-content/uploads/2020/01/foto.jpg';
const MISSING_IMAGE_URL = 'https://esempio.test/wp-content/uploads/2020/01/mancante.jpg';

const SLIDE_ROWS: readonly SqlRow[] = [
  slideRow(
    10,
    2,
    {
      bg: { type: 'image', image: RESOLVABLE_IMAGE_URL },
      timeline: { duration: 9000 },
      version: '6.5.0',
    },
    { '1': { type: 'text', text: 'Titolo della slide' }, top: { type: 'zone' } },
  ),
  slideRow(11, 1, { bg: { type: 'color' }, version: '6.5.0' }, []),
  slideRow(12, 3, { bg: { type: 'image', image: MISSING_IMAGE_URL }, version: '6.5.0' }, []),
];

const WP_POSTMETA: readonly SqlRow[] = [
  { meta_id: 1, post_id: 400, meta_key: '_wp_attached_file', meta_value: '2020/01/foto.jpg' },
];

function buildSource(
  slides: readonly SqlRow[] = SLIDE_ROWS,
  sliders: readonly SqlRow[] = SLIDER_ROWS,
) {
  return fakeSourceReader({
    wp_revslider_sliders: sliders,
    wp_revslider_slides: slides,
    wp_postmeta: WP_POSTMETA,
  });
}

async function seedMedia(db: Database, legacyId: number): Promise<string> {
  const [media] = await db
    .insert(schema.media)
    .values({
      storageKey: '2020/01/foto.jpg',
      publicPath: '/media/2020/01/foto.jpg',
      fileName: 'foto.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1,
      checksum: Buffer.from('00', 'hex'),
      isPrivate: false,
      uploadedAt: new Date(),
      legacyId,
    })
    .returning({ id: schema.media.id });
  await db
    .insert(schema.importIdMap)
    .values({ sourceTable: 'wp_posts', sourceId: legacyId, entity: 'media', entityId: media!.id });
  return media!.id;
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_sliders');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase sliders', () => {
  it('importa lo slider e le sue slide, con posizione, testo dal layer, e sfondo risolto quando possibile', async () => {
    const mediaId = await seedMedia(testDb.db, 400);

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(slidersStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(4); // 1 slider + 3 slide
    expect(result.errors).toBe(0);

    const sliders = await testDb.db.select().from(schema.sliders);
    expect(sliders).toHaveLength(1);
    expect(sliders[0]?.key).toBe('home');
    expect(sliders[0]?.settings).toMatchObject({
      general: { fullWidth: 'on' },
      nav: { arrows: 'on' },
    });
    expect(sliders[0]?.settings).not.toHaveProperty('addOns'); // scartato: descrive la libreria

    const slides = await testDb.db
      .select()
      .from(schema.sliderSlides)
      .orderBy(schema.sliderSlides.position);
    expect(slides).toHaveLength(3);
    expect(slides.map((s) => s.position)).toEqual([1, 2, 3]);

    const withImage = slides.find((s) => s.legacyId === 10);
    expect(withImage?.heading).toBe('Titolo della slide');
    expect(withImage?.mediaId).toBe(mediaId);

    const withoutImage = slides.find((s) => s.legacyId === 11);
    expect(withoutImage?.mediaId).toBeNull();

    const missingImage = slides.find((s) => s.legacyId === 12);
    expect(missingImage?.mediaId).toBeNull();

    const warning = issues.collected.find((i) => i.detail === 'unresolved-slide-background');
    expect(warning?.sourceId).toBe(12);
    // niente avviso per la slide 11: non ha affatto un'immagine di sfondo
    expect(issues.collected.some((i) => i.sourceId === 11)).toBe(false);
  });

  it('rieseguita aggiorna sul posto, non duplica', async () => {
    const beforeSliders = await testDb.db.select().from(schema.sliders);
    const beforeSlides = await testDb.db.select().from(schema.sliderSlides);

    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(slidersStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(4);

    const afterSliders = await testDb.db.select().from(schema.sliders);
    const afterSlides = await testDb.db.select().from(schema.sliderSlides);
    expect(afterSliders.map((s) => s.id)).toEqual(beforeSliders.map((s) => s.id));
    expect(new Set(afterSlides.map((s) => s.id))).toEqual(new Set(beforeSlides.map((s) => s.id)));

    const idMapSlider = await testDb.db
      .select()
      .from(schema.importIdMap)
      .where(eq(schema.importIdMap.entity, 'slider'));
    expect(idMapSlider).toHaveLength(1);
    const idMapSlides = await testDb.db
      .select()
      .from(schema.importIdMap)
      .where(eq(schema.importIdMap.entity, 'slider_slide'));
    expect(idMapSlides).toHaveLength(3);
  });

  it('una slide sintetica corrotta (JSON malformato in `params`) produce un errore e non ferma la fase', async () => {
    const fresh = await createTestDatabase('amoris_importer_sliders_isolation');
    try {
      const brokenSlide: SqlRow = {
        id: 20,
        slider_id: 1,
        slide_order: 4,
        params: 'non è JSON',
        layers: '[]',
      };

      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(slidersStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource([...SLIDE_ROWS, brokenSlide]),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(4); // lo slider e le 3 slide valide, comunque create
      expect(result.errors).toBe(1); // la slide rotta

      const slides = await fresh.db.select().from(schema.sliderSlides);
      expect(slides).toHaveLength(3);
      expect(slides.some((s) => s.legacyId === 20)).toBe(false);

      const failure = issues.collected.find(
        (i) => i.code === 'item-import-failed' && i.sourceId === 20,
      );
      expect(failure).toBeDefined();
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_sliders_plan');
    try {
      const runId = randomUUID();
      const issues = createIssueSink(fresh.db, 'plan', runId);
      const result = await runStage(slidersStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildSource(),
        runId,
        mode: 'plan',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(4);

      const sliders = await fresh.db.select().from(schema.sliders);
      expect(sliders).toHaveLength(0);
      const slides = await fresh.db.select().from(schema.sliderSlides);
      expect(slides).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });
});
