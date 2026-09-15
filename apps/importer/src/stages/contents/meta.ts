/**
 * Lettura dei metadati di `wp_postmeta` e `wp_options` che questa fase usa
 * (`wp-to-postgres-mapping.md` §4.1, §5): la visibilità del titolo e i
 * contenuti in evidenza. Funzioni pure, separate da `index.ts` perché
 * ciascuna ha una sola responsabilità e un solo motivo per cambiare.
 */
import { phpUnserialize } from '../../source/php/unserialize.js';
import type { SqlRow } from '../../source/sql/types.js';

/**
 * `showTitle` — default `true` (`contents.showTitle` nello schema).
 *
 * `st_hide_title_check_option`: 269 righe, **una sola** attiva
 * (`wp-to-postgres-mapping.md` §4.1): un valore troncabile a vero (`'1'`,
 * `'on'`, `'yes'`) nasconde il titolo.
 *
 * `_et_pb_show_title`: 30 righe, 2 a `'off'`. Solo `'off'` nasconde; ogni
 * altro valore, compreso quello assente, lascia il titolo visibile.
 */
export function deriveShowTitle(meta: ReadonlyMap<string, string>): boolean {
  const hideTitle = meta.get('st_hide_title_check_option');
  if (hideTitle && ['1', 'on', 'yes', 'true'].includes(hideTitle.toLowerCase())) {
    return false;
  }
  const diviShowTitle = meta.get('_et_pb_show_title');
  if (diviShowTitle === 'off') {
    return false;
  }
  return true;
}

/**
 * `contents.isSticky` da `wp_options.sticky_posts`
 * (`wp-to-postgres-mapping.md` §5): un array PHP serializzato di identificatori
 * di `wp_posts`. Se il valore manca o non è analizzabile, l'insieme è vuoto:
 * nessun contenuto risulta in evidenza per errore, che è l'esito più sicuro
 * per un campo puramente redazionale.
 */
export function parseStickyPostIds(optionValue: string | undefined): ReadonlySet<number> {
  if (!optionValue) return new Set();
  try {
    const parsed = phpUnserialize(optionValue);
    // Un array PHP serializzato analizza sempre come `Map` (`unserialize.ts`),
    // mai come array JavaScript: qui interessano solo i valori, non le chiavi.
    if (!(parsed instanceof Map)) return new Set();
    const ids = Array.from(parsed.values()).filter((v): v is number => typeof v === 'number');
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export function buildPostMetaIndex(rows: readonly SqlRow[]): ReadonlyMap<number, Map<string, string>> {
  const byPost = new Map<number, Map<string, string>>();
  for (const row of rows) {
    const postId = row['post_id'];
    const id = typeof postId === 'number' ? postId : Number.parseInt(String(postId ?? ''), 10);
    if (!Number.isFinite(id)) continue;
    const key = row['meta_key'];
    if (typeof key !== 'string') continue;
    const value = row['meta_value'];
    if (!byPost.has(id)) byPost.set(id, new Map());
    byPost.get(id)!.set(key, value === null || value === undefined ? '' : String(value));
  }
  return byPost;
}
