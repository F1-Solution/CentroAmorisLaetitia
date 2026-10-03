/**
 * Fase 15 `rewrite` (`importer-spec.md` §4.1, ADR-004 §3.3): riscrive ogni
 * riferimento a `/wp-content/uploads/…` in `/media/…`, nei quattro ambiti
 * che ADR-004 §3.3 elenca — `contents.blocks`, `contents.content_html`,
 * `slider_slides` e `settings` — e in nessun altro.
 *
 * Non è un convertitore di blocchi: tratta il JSON come dato opaco
 * ({@link rewriteJsonValue}), cosi' la stessa regola vale per qualunque
 * forma i blocchi assumano. È **stupida di proposito**: la sua unica
 * responsabilità è sostituire una sottostringa ovunque compaia, ed essere
 * verificabile in un punto solo.
 *
 * **Criterio di uscita**: al termine, zero occorrenze di `wp-content/uploads`
 * nei quattro ambiti. Se non è zero, la fase **fallisce** — non produce un
 * avviso (`importer-spec.md` §4.1, ultima riga) — perché significherebbe che
 * una variante del riferimento è sfuggita alla regola di
 * {@link rewriteUploadsReferences}, e quella è un'anomalia strutturale, non
 * un elemento singolo da isolare.
 */
import { eq } from 'drizzle-orm';
import { databaseNow, schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import { addStageResults } from '../types.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import { hasUploadsReference, rewriteJsonValue, rewriteTextField } from './urlRewrite.js';

async function rewriteContents(ctx: StageContext): Promise<StageResult> {
  const rows = await ctx.tx
    .select({
      id: schema.contents.id,
      legacyId: schema.contents.legacyId,
      blocks: schema.contents.blocks,
      contentHtml: schema.contents.contentHtml,
    })
    .from(schema.contents);

  return forEachItem(
    ctx.tx,
    rows,
    (row): ItemKey => ({ sourceTable: 'contents', sourceId: row.legacyId ?? 0 }),
    async (row, tx) => {
      const rewrittenBlocks = rewriteJsonValue(row.blocks);
      const rewrittenHtml = rewriteTextField(row.contentHtml);
      if (!rewrittenBlocks.changed && !rewrittenHtml.changed) return 'skipped';

      await tx
        .update(schema.contents)
        .set({
          blocks: rewrittenBlocks.changed ? rewrittenBlocks.value : row.blocks,
          contentHtml: rewrittenHtml.changed ? (rewrittenHtml.value ?? '') : row.contentHtml,
          updatedAt: databaseNow(),
        })
        .where(eq(schema.contents.id, row.id));
      return 'updated';
    },
    async (key, error) => {
      await ctx.issues.record({
        severity: 'error',
        stage: 'rewrite',
        code: 'item-import-failed',
        sourceTable: key.sourceTable,
        sourceId: key.sourceId,
        detail: error instanceof Error ? error.name : 'unknown-error',
      });
    },
  );
}

async function rewriteSliderSlides(ctx: StageContext): Promise<StageResult> {
  const rows = await ctx.tx
    .select({
      id: schema.sliderSlides.id,
      legacyId: schema.sliderSlides.legacyId,
      heading: schema.sliderSlides.heading,
      body: schema.sliderSlides.body,
      linkUrl: schema.sliderSlides.linkUrl,
      settings: schema.sliderSlides.settings,
    })
    .from(schema.sliderSlides);

  return forEachItem(
    ctx.tx,
    rows,
    (row): ItemKey => ({ sourceTable: 'slider_slides', sourceId: row.legacyId ?? 0 }),
    async (row, tx) => {
      const heading = rewriteTextField(row.heading);
      const body = rewriteTextField(row.body);
      const linkUrl = rewriteTextField(row.linkUrl);
      const settings = rewriteJsonValue(row.settings);
      const changed = heading.changed || body.changed || linkUrl.changed || settings.changed;
      if (!changed) return 'skipped';

      await tx
        .update(schema.sliderSlides)
        .set({
          heading: heading.changed ? heading.value : row.heading,
          body: body.changed ? body.value : row.body,
          linkUrl: linkUrl.changed ? linkUrl.value : row.linkUrl,
          settings: settings.changed ? settings.value : row.settings,
        })
        .where(eq(schema.sliderSlides.id, row.id));
      return 'updated';
    },
    async (key, error) => {
      await ctx.issues.record({
        severity: 'error',
        stage: 'rewrite',
        code: 'item-import-failed',
        sourceTable: key.sourceTable,
        sourceId: key.sourceId,
        detail: error instanceof Error ? error.name : 'unknown-error',
      });
    },
  );
}

async function rewriteSettings(ctx: StageContext): Promise<StageResult> {
  const rows = await ctx.tx
    .select({ key: schema.settings.key, value: schema.settings.value })
    .from(schema.settings);
  const indexed = rows.map((row, index) => ({ ...row, syntheticId: index }));

  return forEachItem(
    ctx.tx,
    indexed,
    (row): ItemKey => ({ sourceTable: 'settings', sourceId: row.syntheticId }),
    async (row, tx) => {
      const rewritten = rewriteJsonValue(row.value);
      if (!rewritten.changed) return 'skipped';

      await tx
        .update(schema.settings)
        .set({ value: rewritten.value, updatedAt: new Date() })
        .where(eq(schema.settings.key, row.key));
      return 'updated';
    },
    async (key, error) => {
      await ctx.issues.record({
        severity: 'error',
        stage: 'rewrite',
        code: 'item-import-failed',
        sourceTable: key.sourceTable,
        sourceId: key.sourceId,
        detail: error instanceof Error ? error.name : 'unknown-error',
      });
    },
  );
}

/**
 * La verifica di uscita (`importer-spec.md` §4.1): rilegge gli stessi quattro
 * ambiti **dopo** la riscrittura e conta i valori in cui la sottostringa
 * `wp-content/uploads` compare ancora, a prescindere da maiuscole. Non
 * riusa una query SQL con `ILIKE` per restare indipendente dal motore: la
 * stessa funzione {@link hasUploadsReference} usata per riscrivere decide
 * anche qui che cosa conta come "riferimento rimasto".
 */
async function countRemainingUploadsReferences(ctx: StageContext): Promise<number> {
  const [contentsRows, sliderRows, settingsRows] = await Promise.all([
    ctx.tx
      .select({ blocks: schema.contents.blocks, contentHtml: schema.contents.contentHtml })
      .from(schema.contents),
    ctx.tx
      .select({
        heading: schema.sliderSlides.heading,
        body: schema.sliderSlides.body,
        linkUrl: schema.sliderSlides.linkUrl,
        settings: schema.sliderSlides.settings,
      })
      .from(schema.sliderSlides),
    ctx.tx.select({ value: schema.settings.value }).from(schema.settings),
  ]);

  let remaining = 0;
  const check = (value: unknown): void => {
    if (typeof value === 'string') {
      if (hasUploadsReference(value)) remaining += 1;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) check(item);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const entry of Object.values(value)) check(entry);
    }
  };

  for (const row of contentsRows) {
    check(row.blocks);
    check(row.contentHtml);
  }
  for (const row of sliderRows) {
    check(row.heading);
    check(row.body);
    check(row.linkUrl);
    check(row.settings);
  }
  for (const row of settingsRows) {
    check(row.value);
  }
  return remaining;
}

export const rewriteStage: Stage = {
  name: 'rewrite',
  dependsOn: ['contents', 'media'],

  async expected() {
    // Non è una tabella: non c'è un numero di righe da produrre, solo un
    // criterio di uscita booleano (§4.1). `null` come le righe di
    // `database-schema.md` §6 che non sono un intero fisso.
    return null;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const contentsResult = await rewriteContents(ctx);
    const slidesResult = await rewriteSliderSlides(ctx);
    const settingsResult = await rewriteSettings(ctx);
    const total = addStageResults(addStageResults(contentsResult, slidesResult), settingsResult);

    const remaining = await countRemainingUploadsReferences(ctx);
    if (remaining > 0) {
      await ctx.issues.record({
        severity: 'error',
        stage: 'rewrite',
        code: 'uploads-reference-remaining',
        sourceTable: 'contents',
        sourceId: remaining,
        detail: 'uploads-reference-survived-rewrite',
      });
      throw new Error(
        `rewrite: ${remaining} riferimento/i a 'wp-content/uploads' non riscritto/i — la fase fallisce (importer-spec.md §4.1)`,
      );
    }

    return total;
  },
};
