import { DEFAULT_SITE_DATES, formatWpDate, type SiteDates } from './wpDate';

const TRUNCATE_AMOUNT = 270;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
};

/** Le entità del testo contato, decodificate per la pagina. */
function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dec, hex, name) => {
    const code = dec ? Number(dec) : hex ? Number.parseInt(hex, 16) : null;
    if (code === null) return NAMED_ENTITIES[String(name).toLowerCase()] ?? whole;
    // Un'entità fuori dall'intervallo di Unicode resta com'è: non deve fermare la pagina.
    const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
    return valid ? String.fromCodePoint(code) : whole;
  });
}

/**
 * L'estratto scritto a mano, intero e a righe (D139 = B): via i tag, decodificate le
 * entità, un elemento per riga; `null` se resta solo vuoto.
 */
export function excerptLines(excerpt: string): string[] | null {
  const text = decodeEntities(excerpt.replace(/<[^>]*>/g, '')).trim();
  return text === '' ? null : text.split(/\r\n|\r|\n/);
}

/**
 * Senza estratto, il testo degli articoli nell'archivio, come lo tronca il tema
 * (`et_divi.divi_use_excerpt = false`, `truncate_post(270)`): 270 caratteri,
 * spazi finali tolti, poi via l'ultima parola e «...» quando il testo supera i
 * 270 byte. Il testo arriva nella forma che la sorgente contava, con le entità
 * scritte per esteso (D71, DR-155); per i contenuti del CMS è il testo com'è.
 * Ogni carattere vale 1.
 */
export function archiveSummary(text: string): string {
  const clean = text.replace(/[\n\r\t ]+/g, ' ').trim();
  // I puntini dipendono da `strlen`, in byte; il taglio di `et_wp_trim_words` conta i caratteri.
  if (new TextEncoder().encode(clean).length <= TRUNCATE_AMOUNT) return decodeEntities(clean);
  const words = Array.from(clean).slice(0, TRUNCATE_AMOUNT).join('').trimEnd().split(' ');
  if (words.length > 1) words.pop();
  const kept = words.join(' ');
  return kept === '' ? '' : `${decodeEntities(kept)}...`;
}

/** `divi_date_format` della sorgente: opzione del tema che l'area non espone (DR-270). */
export const DIVI_DATE_FORMAT = 'j M Y';

/**
 * La data nella riga dei metadati degli articoli, come la scrive il tema
 * («1 Dic 2017»): formato del tema, lingua e fuso del sito.
 */
export function postDate(iso: string | null, dates: SiteDates = DEFAULT_SITE_DATES): string {
  return iso ? formatWpDate(iso, DIVI_DATE_FORMAT, dates) : '';
}

/** Una data in «Formato data» del sito, come `get_the_date()` («5 Aprile 2022», D75). */
export function longDate(iso: string | null, dates: SiteDates = DEFAULT_SITE_DATES): string {
  return iso ? formatWpDate(iso, dates.dateFormat, dates) : '';
}

/** La dimensione del file come la scrive Download Manager: base 1024, due decimali col punto (D75). */
export function fileSize(bytes: number): string {
  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes / 1024;
  let unit = 0;
  // Si passa all'unità successiva quando l'arrotondamento a due decimali arriverebbe a 1024.
  while (value >= 1023.995 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return bytes < 1024 ? `${bytes} B` : `${value.toFixed(2)} ${units[unit]}`;
}
