import { phpUnserialize } from '../../source/php/unserialize.js';

/**
 * `[catposts name="X"]` del plugin Category Posts nomina una configurazione
 * salvata nei metadati della pagina (`categoryPosts-shorcode`), non una categoria
 * (DR-116, `wp-to-postgres-mapping.md` §5). Il convertitore non vede i metadati:
 * qui i parametri della configurazione si riportano nello shortcode, con i nomi che
 * il convertitore conosce, e solo dove lo shortcode non li dichiara già.
 */

const PARAMS: readonly [config: string, shortcode: string][] = [
  ['cat', 'cat'],
  ['num', 'number'],
  ['thumb', 'thumb'],
  ['date', 'date'],
  ['excerpt', 'excerpt'],
  // Salta i primi N articoli dell'ordinamento (es. «News»: offset 1, salta il più recente).
  ['offset', 'offset'],
];

function configurations(meta: ReadonlyMap<string, string>): ReadonlyMap<unknown, unknown> | null {
  const raw = meta.get('categoryPosts-shorcode');
  if (!raw) return null;
  try {
    const parsed = phpUnserialize(raw);
    return parsed instanceof Map ? parsed : null;
  } catch {
    return null;
  }
}

export function expandCatposts(postContent: string, meta: ReadonlyMap<string, string>): string {
  const saved = configurations(meta);
  if (!saved) return postContent;
  return postContent.replace(/\[catposts\b([^\]]*)\]/g, (whole, attrs: string) => {
    const name = /\bname\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    const config = name === undefined ? undefined : saved.get(name);
    if (!(config instanceof Map)) return whole;
    const extra = PARAMS.filter(([, key]) => !new RegExp(`\\b${key}\\s*=`).test(attrs))
      .map(([from, key]) => [key, config.get(from)] as const)
      .filter(
        (pair): pair is readonly [string, string | number] =>
          typeof pair[1] === 'string' || typeof pair[1] === 'number',
      )
      .map(([key, value]) => ` ${key}="${String(value)}"`)
      .join('');
    return `[catposts${attrs}${extra}]`;
  });
}
