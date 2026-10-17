/**
 * Porto di `wptexturize()` e `wptexturize_primes()` (`wp-includes/formatting.php`
 * della sorgente, righe 37 e 320) con le stringhe della traduzione `it_IT` (DR-151).
 * Nella sorgente il filtro agiva a ogni resa su contenuto, titoli e voci di menu; qui
 * si applica una sola volta, in importazione. Gli shortcode sono già convertiti
 * quando il testo arriva qui, quindi i soli delimitatori sono tag e commenti.
 */

const OPENING_QUOTE = '&#8220;';
const CLOSING_QUOTE = '&#8221;';
const APOS = '&#8217;';
const PRIME = '&#8242;';
const DOUBLE_PRIME = '&#8243;';
const OPENING_SINGLE_QUOTE = '&#8216;';
const CLOSING_SINGLE_QUOTE = '&#8217;';
const EN_DASH = '&#8211;';
const EM_DASH = '&#8212;';

const OPEN_Q_FLAG = '<!--oq-->';
const OPEN_SQ_FLAG = '<!--osq-->';
const APOS_FLAG = '<!--apos-->';

const NO_TEXTURIZE_TAGS = ['pre', 'code', 'kbd', 'style', 'script', 'tt'];

/** `wp_spaces_regexp()`. */
const S = '(?:[\\r\\n\\t ]|\\u00a0|&nbsp;)';
/** `\Z` di PCRE: fine del testo, o prima dell'ultimo a capo. */
const END = '\\n?$';

/** Elisioni della traduzione `it_IT` («Comma-separated list of words to texturize»). */
const COCKNEY = ["da'", "di'", "fa'", "sta'", "va'", "be'", "po'", "mo'", "a'", "de'", "co'"];

const STATIC_CHARACTERS = ['...', '``', "''", ' (tm)', ...COCKNEY];
const STATIC_REPLACEMENTS = [
  '&#8230;',
  OPENING_QUOTE,
  CLOSING_QUOTE,
  ' &#8482;',
  ...COCKNEY.map((word) => word.replace("'", APOS)),
];

type Rule = readonly [RegExp, string];

const APOS_RULES: readonly Rule[] = [
  [
    new RegExp(`'(\\d\\d)'(?=${END}|[.,:;!?)}\\-\\]]|&gt;|${S})`, 'g'),
    `${APOS_FLAG}$1${CLOSING_SINGLE_QUOTE}`,
  ],
  [
    new RegExp(`'(\\d\\d)"(?=${END}|[.,:;!?)}\\-\\]]|&gt;|${S})`, 'g'),
    `${APOS_FLAG}$1${CLOSING_QUOTE}`,
  ],
  [new RegExp(`'(?=\\d\\d(?:${END}|(?![%\\d]|[.,]\\d)))`, 'g'), APOS_FLAG],
  [new RegExp(`(?<=^|${S})'(\\d[.,\\d]*)'`, 'g'), `${OPEN_SQ_FLAG}$1${CLOSING_SINGLE_QUOTE}`],
  [new RegExp(`(?<=^|[([{"\\-]|&lt;|${S})'`, 'g'), OPEN_SQ_FLAG],
  [new RegExp(`(?<!${S})'(?!${END}|[.,:;!?"'(){}[\\]\\-]|&[lg]t;|${S})`, 'g'), APOS_FLAG],
];

const QUOTE_RULES: readonly Rule[] = [
  [new RegExp(`(?<=^|${S})"(\\d[.,\\d]*)"`, 'g'), `${OPEN_Q_FLAG}$1${CLOSING_QUOTE}`],
  [new RegExp(`(?<=^|[([{\\-]|&lt;|${S})"(?!${S})`, 'g'), OPEN_Q_FLAG],
];

const DASH_RULES: readonly Rule[] = [
  [/---/g, EM_DASH],
  [new RegExp(`(?<=^|${S})--(?=$|${S})`, 'g'), EM_DASH],
  [/(?<!xn)--/g, EN_DASH],
  [new RegExp(`(?<=^|${S})-(?=$|${S})`, 'g'), EN_DASH],
];

/** Ogni `&` che non sembra già un'entità diventa `&#038;`, come la sorgente. */
const BARE_AMPERSAND = /&(?!#(?:\d+|x[a-f0-9]+);|[a-z1-4]{1,8};)/gi;

/** `_get_wptexturize_split_regex()` senza shortcode: commenti e tag. */
const SPLIT = /(<!--[\s\S]*?(?:-->|$)|<[^>]*>?)/;

function applyRules(text: string, rules: readonly Rule[]): string {
  return rules.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `wptexturize_primes()`: primi o virgolette di chiusura, frase per frase. */
function texturizePrimes(
  haystack: string,
  needle: string,
  prime: string,
  openQuote: string,
  closeQuote: string,
): string {
  const flag = '<!--wp-prime-or-quote-->';
  const n = escapeRegExp(needle);
  const quotePattern = new RegExp(`${n}(?=${END}|[.,:;!?)}\\-\\]]|&gt;|${S})`, 'g');
  const primePattern = new RegExp(`(?<=\\d)${n}`, 'g');
  const flagAfterDigit = new RegExp(`(?<=\\d)${escapeRegExp(flag)}`, 'g');
  const flagNoDigit = new RegExp(`(?<!\\d)${escapeRegExp(flag)}`, 'g');

  return haystack
    .split(openQuote)
    .map((original, key) => {
      let sentence = original;
      if (!sentence.includes(needle)) return sentence;
      if (key !== 0 && !sentence.includes(closeQuote)) {
        const count = countMatches(sentence, quotePattern);
        sentence = sentence.replace(quotePattern, flag);
        if (count > 1) {
          // Più candidati di chiusura: la «logica vulcaniana» della sorgente.
          const count2 = countMatches(sentence, flagNoDigit);
          sentence = sentence.replace(flagNoDigit, closeQuote);
          if (count2 === 0) {
            const pos = sentence.includes(`${flag}.`)
              ? sentence.lastIndexOf(`${flag}.`)
              : sentence.lastIndexOf(flag);
            sentence = sentence.slice(0, pos) + closeQuote + sentence.slice(pos + flag.length);
          }
          sentence = sentence.replace(primePattern, prime);
          sentence = sentence.replace(flagAfterDigit, prime);
          sentence = sentence.replaceAll(flag, closeQuote);
        } else if (count === 1) {
          sentence = sentence.replaceAll(flag, closeQuote);
          sentence = sentence.replace(primePattern, prime);
        } else {
          sentence = sentence.replace(primePattern, prime);
        }
      } else {
        sentence = sentence.replace(primePattern, prime);
        sentence = sentence.replace(quotePattern, closeQuote);
      }
      if (needle === '"' && sentence.includes('"')) {
        sentence = sentence.replaceAll('"', closeQuote);
      }
      return sentence;
    })
    .join(openQuote);
}

function texturizeSegment(segment: string): string {
  let curl = segment;
  STATIC_CHARACTERS.forEach((from, i) => {
    curl = curl.replaceAll(from, STATIC_REPLACEMENTS[i] ?? from);
  });
  if (curl.includes("'")) {
    curl = applyRules(curl, APOS_RULES);
    curl = texturizePrimes(curl, "'", PRIME, OPEN_SQ_FLAG, CLOSING_SINGLE_QUOTE);
    curl = curl.replaceAll(APOS_FLAG, APOS).replaceAll(OPEN_SQ_FLAG, OPENING_SINGLE_QUOTE);
  }
  if (curl.includes('"')) {
    curl = applyRules(curl, QUOTE_RULES);
    curl = texturizePrimes(curl, '"', DOUBLE_PRIME, OPEN_Q_FLAG, CLOSING_QUOTE);
    curl = curl.replaceAll(OPEN_Q_FLAG, OPENING_QUOTE);
  }
  if (curl.includes('-')) curl = applyRules(curl, DASH_RULES);
  if (/(?<=\d)x\d/.test(curl)) {
    // `(?(?<=0)…)` di PCRE: dopo uno zero servono altre cifre.
    curl = curl.replace(/\b(0[\d.,]+|[1-9][\d.,]*)x(\d[\d.,]*)\b/g, '$1&#215;$2');
  }
  return curl.replace(BARE_AMPERSAND, '&#038;');
}

/** `_wptexturize_pushpop_element()`. */
function pushPop(tag: string, stack: string[]): void {
  const opening = tag.length > 1 && tag[1] !== '/';
  if (!opening && stack.length === 0) return;
  const name = tag.slice(opening ? 1 : 2).split(/[\s>]/)[0] ?? '';
  if (!NO_TEXTURIZE_TAGS.includes(name)) return;
  if (opening) stack.push(name);
  else if (stack.at(-1) === name) stack.pop();
}

const PRODUCED_ENTITIES: Readonly<Record<string, string>> = {
  '&#8216;': '‘',
  '&#8217;': '’',
  '&#8220;': '“',
  '&#8221;': '”',
  '&#8211;': '–',
  '&#8212;': '—',
  '&#8230;': '…',
  '&#8482;': '™',
  '&#8242;': '′',
  '&#8243;': '″',
  '&#215;': '×',
  '&#038;': '&amp;',
};

/** L'HTML trasformato, con i caratteri tipografici in chiaro invece che come entità. */
export function wptexturize(html: string): string {
  return wptexturizeEntities(html).replace(
    /&#(?:8216|8217|8220|8221|8211|8212|8230|8482|8242|8243|215|038);/g,
    (e) => PRODUCED_ENTITIES[e] ?? e,
  );
}

/** L'uscita di `wptexturize()` così come la scrive WordPress, con le entità (D71, DR-155). */
export function wptexturizeEntities(html: string): string {
  if (html === '') return html;
  const stack: string[] = [];
  const out = html.split(SPLIT).map((part) => {
    if (part === '') return part;
    if (part.startsWith('<')) {
      if (part.startsWith('<!--')) return part;
      const tag = part.replace(BARE_AMPERSAND, '&#038;');
      pushPop(tag, stack);
      return tag;
    }
    if (part.trim() === '' || stack.length > 0) return part;
    return texturizeSegment(part);
  });
  return out.join('');
}

const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dec, hex, name) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    return NAMED[String(name).toLowerCase()] ?? whole;
  });
}

/** Titoli ed etichette (`the_title`): testo semplice in entrata e in uscita. */
export function texturizePlain(text: string): string {
  if (text === '') return text;
  return decodeEntities(wptexturize(text));
}
