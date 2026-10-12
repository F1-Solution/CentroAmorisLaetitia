import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { stripDangerousMarkup } from '@amoris/blocks/model';
import type { StageContext } from '../context.js';
import type { SqlRow } from '../../source/sql/types.js';
import { phpUnserialize, type PhpValue } from '../../source/php/unserialize.js';

/**
 * Logo e testo del piè di pagina (DR-117): nella sorgente non sono contenuti ma
 * opzioni del tema (`et_divi.divi_logo`) e widget dell'area del piè di pagina.
 * Diventano due impostazioni modificabili dal CMS: `site.logo_media_id` e
 * `site.footer_html`. Si scrivono nella fase `contents`, dopo i media, perché il
 * logo è un media importato.
 */

/** Aree del piè di pagina di Divi, nell'ordine delle colonne; `sidebar-1` è la barra laterale. */
const FOOTER_AREAS = ['sidebar-2', 'sidebar-3', 'sidebar-4', 'sidebar-5', 'sidebar-6'];

const SITE_ORIGIN = /https?:\/\/(?:www\.)?centroamorislaetitia\.it(?=\/)/gi;

function option(rows: readonly SqlRow[], name: string): PhpValue | null {
  const row = rows.find((r) => r['option_name'] === name);
  const raw = row?.['option_value'];
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    return phpUnserialize(raw);
  } catch {
    return null;
  }
}

const asMap = (value: PhpValue | null | undefined) => (value instanceof Map ? value : null);

/** La chiave nel bucket del logo del tema, da `et_divi.divi_logo`. */
export function logoStorageKey(rows: readonly SqlRow[]): string | null {
  const logo = asMap(option(rows, 'et_divi'))?.get('divi_logo');
  if (typeof logo !== 'string') return null;
  const match = /\/wp-content\/uploads\/(.+)$/.exec(logo.replace(/[?#].*$/, ''));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * L'HTML dei widget delle aree del piè di pagina, nell'ordine delle aree e dei
 * widget: i collegamenti al sito stesso diventano relativi, il markup pericoloso
 * si toglie; il resto, presentazione compresa, resta quello della sorgente.
 */
export function footerHtml(rows: readonly SqlRow[]): string | null {
  const areas = asMap(option(rows, 'sidebars_widgets'));
  if (!areas) return null;
  const sources: Record<string, ReadonlyMap<PhpValue, PhpValue> | null> = {
    custom_html: asMap(option(rows, 'widget_custom_html')),
    text: asMap(option(rows, 'widget_text')),
  };
  const parts: string[] = [];
  for (const area of FOOTER_AREAS) {
    const widgets = asMap(areas.get(area));
    for (const widgetId of widgets?.values() ?? []) {
      if (typeof widgetId !== 'string') continue;
      const match = /^(custom_html|text)-(\d+)$/.exec(widgetId);
      if (!match) continue;
      const instance = asMap(sources[match[1]!]?.get(Number(match[2])));
      const body = instance?.get(match[1] === 'custom_html' ? 'content' : 'text');
      if (typeof body === 'string' && body.trim() !== '') parts.push(body);
    }
  }
  if (parts.length === 0) return null;
  return stripDangerousMarkup(parts.join('\n').replace(SITE_ORIGIN, '')).html;
}

async function upsert(ctx: StageContext, key: string, value: string, label: string) {
  await ctx.tx
    .insert(schema.settings)
    .values({ key, value, label })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value, label, updatedAt: new Date() },
    });
}

export async function writeThemeSettings(
  ctx: StageContext,
  rows: readonly SqlRow[],
): Promise<void> {
  const key = logoStorageKey(rows);
  if (key) {
    const [logo] = await ctx.tx
      .select({ id: schema.media.id })
      .from(schema.media)
      .where(eq(schema.media.storageKey, key))
      .limit(1);
    if (logo) await upsert(ctx, 'site.logo_media_id', logo.id, 'Logo del sito');
  }
  const html = footerHtml(rows);
  if (html) await upsert(ctx, 'site.footer_html', html, 'Testo del piè di pagina');
}
