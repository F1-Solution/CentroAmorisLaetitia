/**
 * Fase 10 `sliders` (`importer-spec.md` §4): produce `sliders` e
 * `slider_slides`.
 *
 * Sorgente: `wp_revslider_sliders` (1 riga, misurata) e `wp_revslider_slides`
 * (12 righe, misurate — `wp-to-postgres-mapping.md` §8). Le altre tabelle
 * `wp_revslider_*` (`_bkp`, `_css`, `_navigations`, `_layer_animations`,
 * `_static_slides`) sono escluse, come già classificato in §1.4 di quel
 * documento: descrivono la libreria, non il comportamento.
 *
 * `params` e `layers` sono **JSON**, non serializzato PHP (misurato: Slider
 * Revolution scrive in JSON, a differenza degli altri plugin di questa
 * sorgente). Un valore che non fa `JSON.parse` è un fatto nuovo: errore
 * strutturale sull'elemento, non un avviso silenzioso.
 *
 * **Sfondo della slide** (`params.bg.image`): un URL completo verso un file
 * sotto `wp-content/uploads/`. Si risolve al `media` corrispondente tramite
 * lo stesso percorso relativo che la fase 3 usa per riconoscere i file
 * (`_wp_attached_file`), non tramite un nuovo lettore: se il percorso non
 * corrisponde a un allegato importato, si registra un avviso e la slide
 * resta senza immagine, come già fa `relations/index.ts` per l'immagine in
 * evidenza.
 *
 * **Testo delle slide** (`layers`): una mappa fra un identificativo di layer
 * e il layer stesso, più le zone (`top`/`middle`/`bottom`) che li
 * raggruppano — le zone hanno `type: 'zone'` e si scartano. Misurato sulle 12
 * slide reali: ciascuna ha **al più un** layer di contenuto, sempre
 * `type: 'text'`. Diventa `heading`; non c'è, in questa sorgente, un secondo
 * layer da cui ricavare `body`, né un layer `button` da cui ricavare
 * `link_label`/`link_url` — restano `null`. Il codice non inventa una
 * struttura a più layer che la sorgente non ha.
 *
 * `settings` (sia di `sliders` che di `slider_slides`) tiene solo le chiavi
 * che descrivono il comportamento reso — tempi, transizioni, navigazione —
 * scartando ciò che descrive la libreria stessa (versione, add-on, codice
 * sorgente dello shortcode): `wp-to-postgres-mapping.md` §8.
 */
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';

interface SourceSliderRow {
  readonly legacyId: number;
  readonly key: string;
  readonly title: string;
  readonly settings: Record<string, unknown>;
}

/**
 * `params`/`layers` restano **testo grezzo** qui: si analizzano dentro il
 * ciclo per elemento di `run()` (`forEachItem`), non nel caricamento
 * collettivo — un JSON malformato deve isolarsi sulla singola slide
 * (`importer-spec.md` §7), non far fallire l'intero caricamento prima che il
 * ciclo per elemento abbia potuto isolarlo.
 */
interface SourceSlideRow {
  readonly legacyId: number;
  readonly sliderLegacyId: number;
  readonly position: number;
  readonly rawParams: string;
  readonly rawLayers: string;
}

interface ParsedSlide {
  readonly heading: string | null;
  readonly body: string | null;
  readonly linkLabel: string | null;
  readonly linkUrl: string | null;
  readonly backgroundImagePath: string | null; // percorso relativo sotto uploads/, se ricavabile
  readonly settings: Record<string, unknown>;
}

/** Chiavi di comportamento tenute da `params` dello slider; il resto descrive la libreria. */
const SLIDER_BEHAVIOR_KEYS: readonly string[] = [
  'general',
  'nav',
  'parallax',
  'scrolleffects',
  'scrolltimeline',
];
/** Idem per la singola slide. */
const SLIDE_BEHAVIOR_KEYS: readonly string[] = ['timeline', 'panzoom', 'slideChange'];

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw); // lascia propagare: chi chiama isola l'errore per elemento
}

function pickKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

/** Il percorso `wp-content/uploads/AAAA/MM/file.ext` dentro un URL completo, se presente. */
function extractUploadsRelativePath(url: string): string | null {
  const marker = 'wp-content/uploads/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

/** Il primo layer di contenuto (non zona) — vedi il commento di testa. */
function firstContentLayer(
  layers: unknown,
): { readonly type: string; readonly text: string | null } | null {
  if (layers === null || typeof layers !== 'object' || Array.isArray(layers)) return null;
  for (const value of Object.values(layers as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue;
    const layer = value as Record<string, unknown>;
    if (layer['type'] === 'zone') continue;
    const text = typeof layer['text'] === 'string' ? layer['text'] : null;
    return { type: String(layer['type'] ?? ''), text };
  }
  return null;
}

async function loadSliderRows(ctx: StageContext): Promise<readonly SourceSliderRow[]> {
  const rows = await ctx.source.rows('wp_revslider_sliders');
  return (rows as readonly SqlRow[]).map((row) => {
    const paramsRaw = asString(row['params']);
    let params: Record<string, unknown> = {};
    try {
      const parsed = paramsRaw ? parseJson(paramsRaw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        params = parsed as Record<string, unknown>;
    } catch {
      params = {}; // errore isolato più sotto, nel ciclo per elemento
    }
    return {
      legacyId: asNumber(row['id']),
      key: asString(row['alias']),
      title: asString(row['title']),
      settings: pickKeys(params, SLIDER_BEHAVIOR_KEYS),
    };
  });
}

async function loadSlideRows(
  ctx: StageContext,
  sliderLegacyId: number,
): Promise<readonly SourceSlideRow[]> {
  const rows = await ctx.source.rows('wp_revslider_slides');
  const result: SourceSlideRow[] = [];
  for (const row of rows as readonly SqlRow[]) {
    if (asNumber(row['slider_id']) !== sliderLegacyId) continue;
    result.push({
      legacyId: asNumber(row['id']),
      sliderLegacyId,
      position: asNumber(row['slide_order']),
      rawParams: asString(row['params']) || '{}',
      rawLayers: asString(row['layers']) || '[]',
    });
  }
  return result;
}

/** Analizza `rawParams`/`rawLayers` di una slide. Lascia propagare un JSON malformato: lo isola `forEachItem`. */
function parseSlide(row: SourceSlideRow): ParsedSlide {
  const params = parseJson(row.rawParams) as Record<string, unknown>;
  const layers = parseJson(row.rawLayers);
  const content = firstContentLayer(layers);

  const bg = params['bg'] as Record<string, unknown> | undefined;
  const bgImage = bg && typeof bg['image'] === 'string' ? bg['image'] : null;

  return {
    heading: content?.type === 'text' ? content.text : null,
    body: null, // nessuna sorgente misurata per un secondo layer: vedi il commento di testa
    linkLabel: null,
    linkUrl: null,
    backgroundImagePath: bgImage ? extractUploadsRelativePath(bgImage) : null,
    settings: pickKeys(params, SLIDE_BEHAVIOR_KEYS),
  };
}

/** `_wp_attached_file` -> id numerico dell'allegato, per risolvere `bg.image` a un `media`. */
async function loadAttachmentIdByRelativePath(
  ctx: StageContext,
): Promise<ReadonlyMap<string, number>> {
  const rows = await ctx.source.rows('wp_postmeta');
  const byPath = new Map<string, number>();
  for (const row of rows as readonly SqlRow[]) {
    if (asString(row['meta_key']) !== '_wp_attached_file') continue;
    byPath.set(asString(row['meta_value']), asNumber(row['post_id']));
  }
  return byPath;
}

export const slidersStage: Stage = {
  name: 'sliders',
  dependsOn: ['media'],

  async expected(ctx: StageContext) {
    const sliders = await loadSliderRows(ctx);
    let total = sliders.length;
    for (const slider of sliders) {
      total += (await loadSlideRows(ctx, slider.legacyId)).length;
    }
    return total;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const sliders = await loadSliderRows(ctx);
    const attachmentIdByPath = await loadAttachmentIdByRelativePath(ctx);

    const allItems: (
      | { readonly kind: 'slider'; readonly row: SourceSliderRow }
      | { readonly kind: 'slide'; readonly row: SourceSlideRow }
    )[] = [];
    for (const slider of sliders) {
      allItems.push({ kind: 'slider', row: slider });
      for (const slide of await loadSlideRows(ctx, slider.legacyId)) {
        allItems.push({ kind: 'slide', row: slide });
      }
    }

    const sliderDbIdByLegacyId = new Map<number, string>();
    // La riga `slider_slides` del rapporto conta le slide, non il carosello
    // che le contiene: `importer-spec.md` §8.1 non ha una riga `sliders`.
    const slides = { created: 0, updated: 0, skipped: 0, errors: 0 };

    const result = await forEachItem(
      ctx.tx,
      allItems,
      (item): ItemKey =>
        item.kind === 'slider'
          ? { sourceTable: 'wp_revslider_sliders', sourceId: item.row.legacyId }
          : { sourceTable: 'wp_revslider_slides', sourceId: item.row.legacyId },
      async (item, tx) => {
        if (item.kind === 'slider') {
          const row = item.row;
          const existingId = await ctx.ids.find(tx, 'wp_revslider_sliders', row.legacyId, 'slider');
          const [written] = await tx
            .insert(schema.sliders)
            .values({
              id: existingId ?? undefined,
              key: row.key,
              title: row.title,
              settings: row.settings,
              legacyId: row.legacyId,
            })
            .onConflictDoUpdate({
              target: schema.sliders.id,
              set: {
                key: row.key,
                title: row.title,
                settings: row.settings,
                legacyId: row.legacyId,
                updatedAt: new Date(),
              },
            })
            .returning({ id: schema.sliders.id });
          if (!written) throw new Error('inserimento di sliders non ha restituito una riga');

          await ctx.ids.remember(
            tx,
            'wp_revslider_sliders',
            row.legacyId,
            'slider',
            written.id,
            ctx.mode === 'apply' ? ctx.runId : null,
            existingId ? 'updated' : 'created',
          );
          sliderDbIdByLegacyId.set(row.legacyId, written.id);
          return existingId ? 'updated' : 'created';
        }

        const row = item.row;
        const parsed = parseSlide(row); // JSON malformato: lancia qui, isolato su questa sola slide
        const sliderId =
          sliderDbIdByLegacyId.get(row.sliderLegacyId) ??
          (await ctx.ids.find(tx, 'wp_revslider_sliders', row.sliderLegacyId, 'slider'));
        if (!sliderId) throw new Error('slide senza slider genitore risolvibile');

        let mediaId: string | null = null;
        if (parsed.backgroundImagePath) {
          const attachmentLegacyId = attachmentIdByPath.get(parsed.backgroundImagePath);
          mediaId = attachmentLegacyId
            ? await ctx.ids.find(tx, 'wp_posts', attachmentLegacyId, 'media')
            : null;
          if (!mediaId) {
            await ctx.issues.record({
              severity: 'warning',
              stage: 'sliders',
              code: 'item-import-failed',
              sourceTable: 'wp_revslider_slides',
              sourceId: row.legacyId,
              detail: 'unresolved-slide-background',
            });
          }
        }

        const existingId = await ctx.ids.find(
          tx,
          'wp_revslider_slides',
          row.legacyId,
          'slider_slide',
        );
        const [written] = await tx
          .insert(schema.sliderSlides)
          .values({
            id: existingId ?? undefined,
            sliderId,
            position: row.position,
            mediaId,
            heading: parsed.heading,
            body: parsed.body,
            linkUrl: parsed.linkUrl,
            linkLabel: parsed.linkLabel,
            settings: parsed.settings,
            legacyId: row.legacyId,
          })
          .onConflictDoUpdate({
            target: schema.sliderSlides.id,
            set: {
              sliderId,
              position: row.position,
              mediaId,
              heading: parsed.heading,
              body: parsed.body,
              linkUrl: parsed.linkUrl,
              linkLabel: parsed.linkLabel,
              settings: parsed.settings,
              legacyId: row.legacyId,
            },
          })
          .returning({ id: schema.sliderSlides.id });
        if (!written) throw new Error('inserimento di slider_slides non ha restituito una riga');

        await ctx.ids.remember(
          tx,
          'wp_revslider_slides',
          row.legacyId,
          'slider_slide',
          written.id,
          ctx.mode === 'apply' ? ctx.runId : null,
          existingId ? 'updated' : 'created',
        );

        const esito = existingId ? 'updated' : 'created';
        slides[esito] += 1;
        return esito;
      },
      async (key, error) => {
        // Un errore su una slide è un errore della riga del rapporto; uno sul
        // carosello no, perché quella riga non esiste.
        if (key.sourceTable === 'wp_revslider_slides') slides.errors += 1;
        await ctx.issues.record({
          severity: 'error',
          stage: 'sliders',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );

    return { ...result, rowResult: slides };
  },
};
