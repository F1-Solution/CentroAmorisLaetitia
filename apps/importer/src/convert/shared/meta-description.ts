/**
 * Description dei metadati come la calcola All in One SEO 5.0.1.1 nella sorgente
 * (DR-179, DR-180): articoli `#post_excerpt` (estratto grezzo, altrimenti testo),
 * pagine `#post_content` (testo, vuoto → estratto). Porto di `Meta/Description.php`
 * getPostDescription, `Utils/Tags.php` e `Traits/Helpers/WpContext.php`
 * getDescriptionFromContent, con `runShortcodes` spento come nella sorgente; le
 * funzioni di WordPress e di PHP sono riprodotte qui sotto, una per una.
 *
 * Il testo si legge grezzo, senza `wptexturize`: per questo gli apici restano
 * dritti. Il chiamante passa il testo **dopo** la restrizione di Members (privacy).
 */

export interface MetaDescriptionInput {
  readonly type: 'page' | 'post';
  /** `post_excerpt` grezzo. */
  readonly excerpt: string;
  /** `post_content` grezzo, già sostituito dal messaggio di Members se riservato. */
  readonly content: string;
}

/** La description della sorgente, o `null` se la sorgente non ne scrive. */
export function metaDescriptionSource(input: MetaDescriptionInput): string | null {
  const fromExcerpt = (): string => prepare(input.excerpt);
  const fromContent = (): string => prepare(sanitize(getDescriptionFromContent(input.content)));
  const description =
    input.type === 'post' ? fromExcerpt() || fromContent() : fromContent() || fromExcerpt();
  return description === '' ? null : description;
}

/** `getDescriptionFromContent()` seguita dalla pulizia di AIOSEO, come la vede la pagina. */
export function descriptionFromContent(content: string): string {
  return prepare(sanitize(getDescriptionFromContent(content)));
}

// ── AIOSEO ───────────────────────────────────────────────────────────────────

/** `WpContext::getDescriptionFromContent()`. */
function getDescriptionFromContent(content: string): string {
  const withoutMedia = content
    .replace(/(<figure.*?\/figure>|<img.*?\/>|<div.*?class="wp-block-embed__wrapper".*?>.*?<\/div>)/gs, '')
    .replaceAll(']]>', ']]&gt;');
  return wpTrimWords(wpStripAllTags(stripShortcodes(withoutMedia)).trim(), 55);
}

/** `Meta\Helpers::prepare()` senza paginazione: ripassa `sanitize()`. */
function prepare(value: string): string {
  return sanitize(sanitize(value));
}

/** `Meta\Helpers::sanitize()` con gli shortcode già tolti e nessun tag AIOSEO da sostituire. */
function sanitize(value: string): string {
  let text = decodeHtmlEntitiesRecursive(value);
  text = text.replaceAll('<3', '&lt;3');
  text = wpStripAllTags(stripShortcodes(text));
  text = decodeHtmlEntities(text);
  return phpTrim(text).replace(/\s+/gu, ' ');
}

function decodeHtmlEntitiesRecursive(value: string): string {
  let current = value;
  for (let i = 0; i < 10; i += 1) {
    const next = decodeHtmlEntities(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

/** `decodeHtmlEntities()`: `&nbsp;` a mano, poi `html_entity_decode(ENT_QUOTES | ENT_HTML401)`. */
export function decodeHtmlEntities(value: string): string {
  return htmlEntityDecode(value.replaceAll('&nbsp;', ' '));
}

// ── WordPress ────────────────────────────────────────────────────────────────

/** `wp_trim_words()` con `$more = ''`, conteggio per parole (italiano). */
function wpTrimWords(text: string, numWords: number): string {
  const words = wpStripAllTags(text)
    .split(/[\n\r\t ]+/)
    .filter((word) => word !== '');
  return words.slice(0, numWords).join(' ');
}

/** `wp_strip_all_tags()` senza `$remove_breaks`. */
function wpStripAllTags(text: string): string {
  return phpTrim(phpStripTags(text.replace(/<(script|style)[^>]*?>.*?<\/\1>/gis, '')));
}

/**
 * Shortcode registrati nella sorgente: i moduli di Divi, quelli del nucleo e dei
 * plugin attivi. Gli altri (per esempio `[event_dashboard]`, plugin spento)
 * restano nel testo, come in WordPress.
 */
const REGISTERED_SHORTCODES = new Set([
  'wp_caption',
  'caption',
  'gallery',
  'playlist',
  'audio',
  'video',
  'embed',
  'catposts',
  'wpforms',
]);
const REGISTERED_PREFIXES = ['et_pb_', 'wpdm_'];

function isRegisteredShortcode(name: string): boolean {
  return REGISTERED_SHORTCODES.has(name) || REGISTERED_PREFIXES.some((p) => name.startsWith(p));
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

/** `strip_shortcodes()`: toglie lo shortcode registrato **con** il contenuto racchiuso. */
function stripShortcodes(content: string): string {
  if (!content.includes('[')) return content;
  // eslint-disable-next-line no-control-regex -- la stessa classe di caratteri di `strip_shortcodes()`.
  const present = [...content.matchAll(/\[([^<>&/[\]\x00-\x20=]+)/g)].map((m) => m[1] ?? '');
  const tagnames = [...new Set(present)].filter(isRegisteredShortcode);
  if (tagnames.length === 0) return content;
  const protectedContent = protectShortcodesInHtml(content);
  const tags = tagnames.map(escapeRegExp).join('|');
  // `get_shortcode_regex()`, senza i quantificatori possessivi che JavaScript non ha.
  const pattern = new RegExp(
    `\\[(\\[?)(${tags})(?![\\w-])([^\\]\\/]*(?:\\/(?!\\])[^\\]\\/]*)*?)(?:(\\/)\\]|\\](?:([^\\[]*(?:\\[(?!\\/\\2\\])[^\\[]*)*)\\[\\/\\2\\])?)(\\]?)`,
    'g',
  );
  const stripped = protectedContent.replace(
    pattern,
    (whole: string, open: string, ...groups: unknown[]) => {
      const close = String(groups[4] ?? '');
      // `strip_shortcode_tag()`: lo shortcode fra doppie parentesi resta scritto.
      if (open === '[' && close === ']') return whole.slice(1, -1);
      return open + close;
    },
  );
  return stripped.replaceAll('&#91;', '[').replaceAll('&#93;', ']');
}

/** `do_shortcodes_in_html_tags($content, true)`: le parentesi dentro tag e commenti non contano. */
function protectShortcodesInHtml(content: string): string {
  const escaped = content.replaceAll('&#91;', '&#091;').replaceAll('&#93;', '&#093;');
  return escaped.replace(
    /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<[^>]*>?/g,
    (element) => {
      if (!element.includes('[') && !element.includes(']')) return element;
      return element.replaceAll('[', '&#91;').replaceAll(']', '&#93;');
    },
  );
}

// ── PHP ──────────────────────────────────────────────────────────────────────

/** `trim()` di PHP: solo spazio, tab, a capo, NUL e tab verticale. */
function phpTrim(text: string): string {
  // eslint-disable-next-line no-control-regex -- i caratteri che `trim()` di PHP toglie.
  return text.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

const isSpace = (char: string | undefined): boolean =>
  char !== undefined && /[ \t\n\r\v\f]/.test(char);

/**
 * `strip_tags()` di PHP 8 senza tag ammessi: macchina a stati di
 * `php_strip_tags_ex()`. Toglie i tag senza aggiungere spazi; un commento finisce
 * solo su `-->`; un `<` seguito da spazio è testo.
 */
export function phpStripTags(input: string): string {
  let out = '';
  let state = 0; // 0 testo, 1 tag, 2 PHP, 3 `<!`, 4 commento
  let depth = 0;
  let inQuote = '';
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i] as string;
    const prev = input[i - 1];
    if (state === 0) {
      if (c === '<') {
        if (isSpace(input[i + 1])) out += c;
        else state = 1;
      } else if (c === '>') {
        if (depth > 0) depth -= 1;
        else out += c;
      } else out += c;
    } else if (state === 1) {
      if (c === '<') {
        if (!inQuote && !isSpace(input[i + 1])) depth += 1;
      } else if (c === '>') {
        if (depth > 0) depth -= 1;
        else if (!inQuote) state = 0;
      } else if (c === '"' || c === "'") {
        if (!inQuote) inQuote = c;
        else if (inQuote === c) inQuote = '';
      } else if (c === '!' && prev === '<') state = 3;
      else if (c === '?' && prev === '<') state = 2;
    } else if (state === 2) {
      if (c === '>' && prev === '?') state = 0;
    } else if (state === 3) {
      if (c === '>') {
        if (depth > 0) depth -= 1;
        else if (!inQuote) state = 0;
      } else if (c === '"' || c === "'") {
        if (prev !== '\\' && (!inQuote || inQuote === c)) inQuote = inQuote ? '' : c;
      } else if (c === '-' && prev === '-' && input[i - 2] === '!') state = 4;
      else if ((c === 'E' || c === 'e') && /doctyp$/i.test(input.slice(i - 6, i))) state = 1;
    } else if (c === '>' && prev === '-' && input[i - 2] === '-') {
      state = 0;
      inQuote = '';
    }
  }
  return out;
}

/** Entità nominate di HTML 4.01, quelle che `html_entity_decode(ENT_HTML401)` conosce. */
const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(
    ' ',
  );
const GREEK_UPPER =
  'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho _ Sigma Tau Upsilon Phi Chi Psi Omega'.split(
    ' ',
  );
const GREEK_LOWER =
  'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigmaf sigma tau upsilon phi chi psi omega'.split(
    ' ',
  );
const OTHERS =
  'quot:34 amp:38 lt:60 gt:62 OElig:338 oelig:339 Scaron:352 scaron:353 Yuml:376 fnof:402 circ:710 tilde:732 thetasym:977 upsih:978 piv:982 ensp:8194 emsp:8195 thinsp:8201 zwnj:8204 zwj:8205 lrm:8206 rlm:8207 ndash:8211 mdash:8212 lsquo:8216 rsquo:8217 sbquo:8218 ldquo:8220 rdquo:8221 bdquo:8222 dagger:8224 Dagger:8225 bull:8226 hellip:8230 permil:8240 prime:8242 Prime:8243 lsaquo:8249 rsaquo:8250 oline:8254 frasl:8260 euro:8364 image:8465 weierp:8472 real:8476 trade:8482 alefsym:8501 larr:8592 uarr:8593 rarr:8594 darr:8595 harr:8596 crarr:8629 lArr:8656 uArr:8657 rArr:8658 dArr:8659 hArr:8660 forall:8704 part:8706 exist:8707 empty:8709 nabla:8711 isin:8712 notin:8713 ni:8715 prod:8719 sum:8721 minus:8722 lowast:8727 radic:8730 prop:8733 infin:8734 ang:8736 and:8743 or:8744 cap:8745 cup:8746 int:8747 there4:8756 sim:8764 cong:8773 asymp:8776 ne:8800 equiv:8801 le:8804 ge:8805 sub:8834 sup:8835 nsub:8836 sube:8838 supe:8839 oplus:8853 otimes:8855 perp:8869 sdot:8901 lceil:8968 rceil:8969 lfloor:8970 rfloor:8971 lang:9001 rang:9002 loz:9674 spades:9824 clubs:9827 hearts:9829 diams:9830'.split(
    ' ',
  );

export const HTML401_ENTITIES: ReadonlyMap<string, number> = new Map([
  ...LATIN1.map((name, i): [string, number] => [name, 160 + i]),
  ...GREEK_UPPER.filter((name) => name !== '_').map(
    (name): [string, number] => [name, 913 + GREEK_UPPER.indexOf(name)],
  ),
  ...GREEK_LOWER.map((name, i): [string, number] => [name, 945 + i]),
  ...OTHERS.map((pair): [string, number] => {
    const [name, code] = pair.split(':');
    return [name ?? '', Number(code)];
  }),
]);

/** `unicode_cp_is_allowed()` per HTML 4.01: i codici numerici fuori elenco restano scritti. */
function isAllowedCodePoint(cp: number): boolean {
  return (
    (cp >= 0x20 && cp <= 0x7e) ||
    cp === 0x0a ||
    cp === 0x09 ||
    cp === 0x0d ||
    (cp >= 0xa0 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0x10ffff && (cp & 0xffff) < 0xfffe && (cp < 0xfdd0 || cp > 0xfdef))
  );
}

/** `html_entity_decode($text, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML401)`. */
function htmlEntityDecode(text: string): string {
  return text.replace(
    /&(?:#([0-9]+)|#[xX]([0-9a-fA-F]+)|([A-Za-z][A-Za-z0-9]*));/g,
    (whole, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
      if (name !== undefined) {
        const code = HTML401_ENTITIES.get(name);
        return code === undefined ? whole : String.fromCodePoint(code);
      }
      const cp = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex ?? '', 16);
      return Number.isFinite(cp) && isAllowedCodePoint(cp) ? String.fromCodePoint(cp) : whole;
    },
  );
}
