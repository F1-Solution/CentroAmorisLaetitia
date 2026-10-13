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
  // «Inizia dall'articolo N», contato da 1 (DR-130): il convertitore lo traduce.
  ['offset', 'offset'],
  ['thumbTop', 'thumb_top'],
  ['thumb_w', 'thumb_w'],
  ['thumb_h', 'thumb_h'],
  ['excerpt_length', 'excerpt_length'],
  ['excerpt_more_text', 'excerpt_more_text'],
  // Il refuso è del plugin: la chiave salvata si chiama così.
  ['default_thunmbnail', 'default_thumbnail'],
];

/** Il percorso di un allegato dato il suo identificativo, per la miniatura di riserva. */
export type AttachmentPathResolver = (legacyId: string) => string | null;

/** Un valore salvato come lo vede lo shortcode: i booleani PHP diventano «1»/«0». */
function shortcodeValue(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.replace(/"/g, '');
  return null;
}

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

export function expandCatposts(
  postContent: string,
  meta: ReadonlyMap<string, string>,
  attachmentPath: AttachmentPathResolver = () => null,
): string {
  const saved = configurations(meta);
  if (!saved) return postContent;
  return postContent.replace(/\[catposts\b([^\]]*)\]/g, (whole, attrs: string) => {
    const name = /\bname\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    const config = name === undefined ? undefined : saved.get(name);
    if (!(config instanceof Map)) return whole;
    const extra = PARAMS.filter(([, key]) => !new RegExp(`\\b${key}\\s*=`).test(attrs))
      .map(([from, key]) => {
        const value = shortcodeValue(config.get(from));
        if (key !== 'default_thumbnail' || value === null) return [key, value] as const;
        return [key, attachmentPath(value)] as const;
      })
      .filter((pair): pair is readonly [string, string] => pair[1] !== null && pair[1] !== '')
      .map(([key, value]) => ` ${key}="${value}"`)
      .join('');
    return `[catposts${attrs}${extra}]`;
  });
}
