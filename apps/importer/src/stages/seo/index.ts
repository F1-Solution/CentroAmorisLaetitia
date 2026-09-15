/**
 * Fase 8 `seo` (`importer-spec.md` §4): produce `content_seo` e `term_seo`.
 *
 * `wp-to-postgres-mapping.md` §6: **si migrano le regole, non i record**. I
 * template globali (`seo_templates`) sono già stati importati dalla fase 1
 * `settings`; questa fase importa solo le **sovrascritture per singolo
 * contenuto**, e sono quasi tutte assenti.
 *
 * Misurato sulla sorgente reale (`wp_aioseo_posts`, 282 righe): solo **2**
 * hanno un `title` non vuoto; `description`, `og_*`, `twitter_*` e
 * `canonical_url` sono vuoti in **tutte** le 282 righe; `robots_default` vale
 * `1` (usa il predefinito del sito) in tutte le 282, quindi
 * `robots_noindex`/`robots_nofollow` non hanno mai un valore che diverga dal
 * predefinito dello schema (`false`). Il codice resta comunque generico sulle
 * colonne `robots_*` e su `canonical_url`, perché il mapping le classifica
 * come importabili «dove non vuoto» — non si scrive un codice che funziona
 * solo per lo stato attuale della sorgente.
 *
 * **`term_seo` è vuota per questa sorgente**: non esiste, nel dump, alcuna
 * riga di SEO a livello di termine — `wp_termmeta` ha 4 righe, tutte del
 * plugin WP Download Manager (`__wpdm_*`), non di AIOSEO. Il codice qui
 * importerebbe righe di `wp_aioseo_terms` se la sorgente ne avesse: quella
 * tabella non esiste nel dump. `expected()` conta correttamente 0 per i
 * termini, non è un difetto tacere quando non c'è nulla da dire.
 */
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { addStageResults, emptyStageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';

interface AioseoRow {
  readonly aioseoId: number;
  readonly postLegacyId: number;
  readonly title: string | null;
  readonly canonicalUrl: string | null;
  readonly robotsDefault: boolean;
  readonly robotsNoindex: boolean;
  readonly robotsNofollow: boolean;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function asBoolLike(value: SqlRow[string] | undefined): boolean {
  const s = asString(value);
  return s === '1' || s === 'true';
}

/**
 * Solo le righe con **almeno un campo non vuoto/non predefinito** fra quelli
 * importabili: le altre non produrrebbero alcuna sovrascrittura, e non vale
 * la pena scrivere una riga `content_seo` vuota per ciascuno dei 282 post.
 */
async function loadAioseoRows(ctx: StageContext): Promise<readonly AioseoRow[]> {
  const rows = await ctx.source.rows('wp_aioseo_posts');
  const result: AioseoRow[] = [];
  for (const row of rows as readonly SqlRow[]) {
    const title = asString(row['title']).trim() || null;
    const canonicalUrl = asString(row['canonical_url']).trim() || null;
    const robotsDefault = asBoolLike(row['robots_default']);
    const robotsNoindex = !robotsDefault && asBoolLike(row['robots_noindex']);
    const robotsNofollow = !robotsDefault && asBoolLike(row['robots_nofollow']);

    if (title === null && canonicalUrl === null && !robotsNoindex && !robotsNofollow) {
      continue; // nessuna sovrascrittura da questa riga
    }

    result.push({
      aioseoId: asNumber(row['id']),
      postLegacyId: asNumber(row['post_id']),
      title,
      canonicalUrl,
      robotsDefault,
      robotsNoindex,
      robotsNofollow,
    });
  }
  return result;
}

export const seoStage: Stage = {
  name: 'seo',
  dependsOn: ['contents'],

  async expected(ctx: StageContext) {
    // term_seo è sempre 0 per questa sorgente: vedi il commento di testa.
    return (await loadAioseoRows(ctx)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const rows = await loadAioseoRows(ctx);

    const contentResult = await forEachItem(
      ctx.tx,
      rows,
      (row): ItemKey => ({ sourceTable: 'wp_aioseo_posts', sourceId: row.aioseoId }),
      async (row, tx) => {
        const contentId = await ctx.ids.find(tx, 'wp_posts', row.postLegacyId, 'content');
        if (!contentId) {
          await ctx.issues.record({
            severity: 'warning',
            stage: 'seo',
            code: 'item-import-failed',
            sourceTable: 'wp_aioseo_posts',
            sourceId: row.aioseoId,
            detail: 'unresolved-content-reference',
          });
          return 'skipped';
        }

        const [existing] = await tx
          .select({ contentId: schema.contentSeo.contentId })
          .from(schema.contentSeo)
          .where(eq(schema.contentSeo.contentId, contentId));

        await tx
          .insert(schema.contentSeo)
          .values({
            contentId,
            title: row.title,
            canonicalUrl: row.canonicalUrl,
            robotsNoindex: row.robotsNoindex,
            robotsNofollow: row.robotsNofollow,
          })
          .onConflictDoUpdate({
            target: schema.contentSeo.contentId,
            set: {
              title: row.title,
              canonicalUrl: row.canonicalUrl,
              robotsNoindex: row.robotsNoindex,
              robotsNofollow: row.robotsNofollow,
              updatedAt: new Date(),
            },
          });

        return existing ? 'updated' : 'created';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'seo',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );

    // term_seo: nessuna sorgente per questo dump (vedi commento di testa).
    // Non si scrive nulla: `emptyStageResult()` rende esplicito che questa
    // parte della fase è stata considerata e non ha trovato niente da fare,
    // non che sia stata saltata.
    return addStageResults(contentResult, emptyStageResult());
  },
};
