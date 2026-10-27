/**
 * Slug di un documento creato dall'area (DR-281): la regola con cui WordPress ha dato il
 * `post_name` ai download di Download Manager, che l'importer copia (`sanitize_title()` nel
 * contesto «save» e `wp_unique_post_slug()`). Scostamento dichiarato: i caratteri che restano
 * fuori dall'alfabeto latino si tolgono invece di essere codificati con `%`.
 */

const MAX_LENGTH = 200;
const FALLBACK = 'documento';

/** I nomi dei feed di WordPress ed `embed`: `wp_unique_post_slug()` non li dà mai. */
export const RESERVED_DOCUMENT_SLUGS: ReadonlySet<string> = new Set([
  'feed',
  'rdf',
  'rss',
  'rss2',
  'atom',
  'embed',
]);

/** Le lettere che `remove_accents()` traduce in più lettere o che NFD non scompone. */
const LETTERS: Readonly<Record<string, string>> = {
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  ø: 'o',
  Ø: 'O',
  đ: 'd',
  Đ: 'D',
  ð: 'd',
  Ð: 'D',
  þ: 'th',
  Þ: 'TH',
  ł: 'l',
  Ł: 'L',
  ħ: 'h',
  Ħ: 'H',
  ı: 'i',
};

/** Spazio unificatore, trattini e spazi tipografici: WordPress li fa diventare `-`. */
const AS_HYPHEN = /[\u00a0\u2011\u2013\u2014\u2000-\u200a\u2028\u2029\u202f/]/g;

function removeAccents(text: string): string {
  return text
    .replace(/[ßæÆœŒøØđĐðÐþÞłŁħĦı]/g, (letter) => LETTERS[letter] ?? letter)
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function trimHyphens(text: string): string {
  return text.replace(/^-+|-+$/g, '');
}

/** Lo slug proposto dal titolo, al massimo 200 caratteri; «documento» se non resta nulla. */
export function documentSlugFromTitle(title: string): string {
  const slug = removeAccents(title.replace(/<[^>]*>/g, ''))
    .toLowerCase()
    .replace(AS_HYPHEN, '-')
    .replace(/×/g, 'x')
    .replace(/&.+?;/g, '')
    .replace(/\./g, '-')
    .replace(/[^a-z0-9 _\-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  const trimmed = trimHyphens(trimHyphens(slug).slice(0, MAX_LENGTH));
  return trimmed || FALLBACK;
}

/** Il primo slug libero: quello dato, altrimenti `-2`, `-3`, … entro i 200 caratteri. */
export function nextFreeSlug(base: string, taken: ReadonlySet<string>): string {
  const free = (candidate: string) =>
    !taken.has(candidate) && !RESERVED_DOCUMENT_SLUGS.has(candidate);
  if (free(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const room = MAX_LENGTH - (String(suffix).length + 1);
    const candidate = `${trimHyphens(base.slice(0, room))}-${suffix}`;
    if (free(candidate)) return candidate;
  }
}
