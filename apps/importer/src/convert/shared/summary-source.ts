/**
 * Il testo da cui il tema della sorgente ricava l'estratto di archivio e ricerca,
 * nella forma in cui lo conta (D71, DR-155): `truncate_post()` di Divi
 * (`epanel/custom_functions.php:316`) toglie didascalie, navigazione, audio ed
 * embed, poi tutti i tag (`wp_strip_all_tags`), applica `the_content` e conta i
 * caratteri del risultato senza tag. Le entità prodotte da `wptexturize()`
 * restano scritte per esteso (`&#8217;` vale 7), i caratteri dell'autore valgono 1.
 */
import { wptexturizeEntities } from './wptexturize.js';

/** Abbastanza per i 270 caratteri di `truncate_post(270)`, entità comprese. */
export const SUMMARY_SOURCE_LENGTH = 600;

const REMOVED_SHORTCODES = ['caption', 'et_pb_post_nav', 'audio', 'embed'].map(
  (name) => new RegExp(`\\[${name}[^\\]]*?\\].*?\\[\\/${name}]`, 'gis'),
);

/** Uno shortcode aperto o chiuso; Divi codifica le parentesi quadre negli attributi. */
const SHORTCODE_TAG = /\[\/?[a-zA-Z_][\w-]*(?:\s[^\]]*)?\/?\]/g;

/** Delimitatore che il porto di `wptexturize` tratta come un commento, come WordPress uno shortcode. */
const DELIMITER = '<!--sc-->';

/** `wp_strip_all_tags()` senza togliere gli a capo. */
function stripAllTags(text: string): string {
  return text
    .replace(/<(script|style)[^>]*?>.*?<\/\1>/gis, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

export function summarySource(postContent: string): string {
  let text = postContent;
  for (const pattern of REMOVED_SHORTCODES) text = text.replace(pattern, '');
  text = stripAllTags(text);
  // `do_shortcode` gira dopo `wptexturize`, che salta gli shortcode: il testo fra due shortcode è un segmento a sé.
  text = wptexturizeEntities(text.replace(SHORTCODE_TAG, DELIMITER));
  // I moduli resi da Divi sono separati da spazi bianchi del loro markup.
  text = text.replaceAll(DELIMITER, ' ').replace(/<[^>]*>/g, '');
  const clean = text.replace(/[\n\r\t ]+/g, ' ').trim();
  return Array.from(clean).slice(0, SUMMARY_SOURCE_LENGTH).join('');
}
