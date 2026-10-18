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
import { decodeHtmlEntities } from '../../convert/shared/meta-description.js';
import { phpUnserialize } from '../../source/php/unserialize.js';

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

export interface AioseoTitleOptions {
  /** `searchAppearance.global.separator`, già decodificato. */
  readonly separator: string;
  /** `blogdescription` della sorgente. */
  readonly tagline: string;
}

export interface AioseoTitleTranslation {
  readonly title: string;
  readonly unknown: readonly string[];
  readonly taglineMissing: boolean;
}

/**
 * Le variabili di All in One SEO nel modello del sito (DR-174, DR-191):
 * `#post_title` → `{title}`, `#site_title` → `{site_title}`, `#separator_sa` → il
 * separatore, `#tagline` → lo slogan; i separatori rimasti in testa o in coda si tolgono.
 */
export function translateAioseoTitle(
  raw: string,
  options: AioseoTitleOptions,
): AioseoTitleTranslation {
  const unknown: string[] = [];
  let taglineMissing = false;
  const replaced = raw.replace(/#([a-z][a-z0-9_]*)/gi, (whole, name: string) => {
    switch (name) {
      case 'post_title':
        return '{title}';
      case 'site_title':
        return '{site_title}';
      case 'separator_sa':
        return options.separator;
      case 'tagline':
        if (options.tagline.trim() === '') taglineMissing = true;
        return options.tagline.trim();
      default:
        unknown.push(name);
        return whole;
    }
  });
  const words = replaced.split(/\s+/).filter((word) => word !== '');
  while (words.length > 0 && words[0] === options.separator) words.shift();
  while (words.length > 0 && words[words.length - 1] === options.separator) words.pop();
  return { title: words.join(' '), unknown, taglineMissing };
}

function optionValue(rows: readonly SqlRow[], name: string): string | null {
  const row = rows.find((r) => asString(r['option_name']) === name);
  return row ? asString(row['option_value']) : null;
}

/** Il separatore dei titoli dalle opzioni di AIOSEO (JSON, a volte serializzato in PHP). */
function aioseoSeparator(rows: readonly SqlRow[]): string | null {
  const raw = optionValue(rows, 'aioseo_options');
  if (raw === null) return null;
  try {
    const text = raw.startsWith('s:') ? String(phpUnserialize(raw)) : raw;
    const parsed = JSON.parse(text) as {
      searchAppearance?: { global?: { separator?: unknown } };
    };
    const separator = parsed.searchAppearance?.global?.separator;
    return typeof separator === 'string' && separator.trim() !== ''
      ? decodeHtmlEntities(separator).trim()
      : null;
  } catch {
    return null;
  }
}

/** Separatore predefinito di All in One SEO. */
const DEFAULT_SEPARATOR = '-';

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
    const optionRows = (await ctx.source.rows('wp_options')) as readonly SqlRow[];
    const separator = aioseoSeparator(optionRows);
    const titleOptions: AioseoTitleOptions = {
      separator: separator ?? DEFAULT_SEPARATOR,
      tagline: optionValue(optionRows, 'blogdescription') ?? '',
    };

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

        const translated = row.title ? translateAioseoTitle(row.title, titleOptions) : null;
        if (translated) {
          const separatorGuessed = separator === null && (row.title ?? '').includes('#separator_sa');
          await recordTitleIssues(ctx, row.aioseoId, translated, separatorGuessed);
        }
        const title = translated?.title || null;

        const [existing] = await tx
          .select({ contentId: schema.contentSeo.contentId })
          .from(schema.contentSeo)
          .where(eq(schema.contentSeo.contentId, contentId));

        await tx
          .insert(schema.contentSeo)
          .values({
            contentId,
            title,
            canonicalUrl: row.canonicalUrl,
            robotsNoindex: row.robotsNoindex,
            robotsNofollow: row.robotsNofollow,
          })
          .onConflictDoUpdate({
            target: schema.contentSeo.contentId,
            set: {
              title,
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

/** Variabili non tradotte, slogan assente o separatore illeggibile: si segnalano, non si inventano. */
async function recordTitleIssues(
  ctx: StageContext,
  aioseoId: number,
  translated: AioseoTitleTranslation,
  separatorGuessed: boolean,
): Promise<void> {
  const record = (detail: string) =>
    ctx.issues.record({
      severity: 'warning',
      stage: 'seo',
      code: 'seo-title-variable-unresolved',
      sourceTable: 'wp_aioseo_posts',
      sourceId: aioseoId,
      detail,
    });
  if (translated.unknown.length > 0) await record('unknown-variable');
  if (translated.taglineMissing) await record('tagline-empty');
  if (separatorGuessed) await record('separator-default');
}
