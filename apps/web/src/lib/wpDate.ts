/**
 * Date come `wp_date()` di WordPress (DR-270): stringhe di formato di `date()` di
 * PHP, nomi di mesi e giorni nella lingua del sito, fuso del sito. I valori di
 * riserva sono quelli importati dalla sorgente, così un'impostazione assente o
 * assurda lascia il sito com'è.
 */

export interface SiteDates {
  /** Lingua del sito in BCP 47 («it-IT»). */
  readonly locale: string;
  /** Fuso IANA («Europe/Rome»). */
  readonly timeZone: string;
  /** `date_format` di WordPress. */
  readonly dateFormat: string;
  /** `time_format` di WordPress: nessun punto del sito lo usa, come nella sorgente. */
  readonly timeFormat: string;
}

export const DEFAULT_SITE_DATES: SiteDates = {
  locale: 'it-IT',
  timeZone: 'Europe/Rome',
  dateFormat: 'j F Y',
  timeFormat: 'G:i',
};

/** I nomi della traduzione `it_IT` di WordPress della sorgente, non quelli di Intl. */
const ITALIANO = {
  months: [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre',
  ],
  monthsShort: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
  weekdays: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
  weekdaysShort: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
  am: 'am',
  pm: 'pm',
};

type Names = typeof ITALIANO;

const WP_LOCALE = /^([a-z]{2,3})(?:_([A-Z]{2}|\d{3}))?(?:_[A-Za-z0-9]+)?$/;

/** La lingua di WordPress («it_IT», «de_DE_formal») nelle sue parti; `null` se non lo è. */
function localeParts(value: unknown): { language: string; region: string | null } | null {
  const match = typeof value === 'string' ? WP_LOCALE.exec(value) : null;
  return match?.[1] ? { language: match[1], region: match[2] ?? null } : null;
}

function bcp47Of(settings: Readonly<Record<string, unknown>>): string {
  const parts = localeParts(settings['site.locale']);
  if (!parts) return DEFAULT_SITE_DATES.locale;
  return parts.region ? `${parts.language}-${parts.region}` : parts.language;
}

function validTimeZone(value: unknown): string | null {
  return typeof value === 'string' && isCanonicalTimeZone(value) ? value : null;
}

/** Solo nomi IANA: canonici per Intl, «UTC» o un loro alias scritto con le maiuscole giuste; mai uno scarto come «+01:00». */
export function isCanonicalTimeZone(value: string): boolean {
  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
  const known = resolved === 'UTC' || Intl.supportedValuesOf('timeZone').includes(resolved);
  if (!known) return false;
  // «europe/rome» si risolve in «Europe/Rome»: è lo stesso nome scritto male, non un alias.
  return value === resolved || value.toLowerCase() !== resolved.toLowerCase();
}

/** Lingua, fuso e formati dalle impostazioni pubbliche; ogni valore inutilizzabile torna a quello di oggi. */
export function siteDatesFrom(settings: Readonly<Record<string, unknown>>): SiteDates {
  const format = (key: string, fallback: string) => {
    const value = settings[key];
    return typeof value === 'string' ? value : fallback;
  };
  return {
    locale: bcp47Of(settings),
    timeZone: validTimeZone(settings['site.timezone']) ?? DEFAULT_SITE_DATES.timeZone,
    dateFormat: format('site.date_format', DEFAULT_SITE_DATES.dateFormat),
    timeFormat: format('site.time_format', DEFAULT_SITE_DATES.timeFormat),
  };
}

/** Lingua dei contenuti in BCP 47, come `get_bloginfo('language')` («it-IT»). */
export function languageOf(settings: Readonly<Record<string, unknown>>): string {
  return bcp47Of(settings);
}

/** L'attributo `lang` dell'HTML: la sola lingua («it»), come il sito approvato. */
export function htmlLangOf(settings: Readonly<Record<string, unknown>>): string {
  return localeParts(settings['site.locale'])?.language ?? 'it';
}

/** `og:locale` nella forma di WordPress («it_IT»), come All in One SEO. */
export function ogLocaleOf(settings: Readonly<Record<string, unknown>>): string {
  const parts = localeParts(settings['site.locale']);
  if (!parts) return 'it_IT';
  return parts.region ? `${parts.language}_${parts.region}` : parts.language;
}

const namesCache = new Map<string, Names>();

/** I nomi per una lingua senza tabella propria, da Intl; l'italiano usa quella di WordPress. */
function namesFor(locale: string): Names {
  if (locale === 'it' || locale.startsWith('it-')) return ITALIANO;
  const cached = namesCache.get(locale);
  if (cached) return cached;
  const pick = (options: Intl.DateTimeFormatOptions, date: Date) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date);
  const month = (m: number) => new Date(Date.UTC(2024, m, 15));
  // Il 7 gennaio 2024 è domenica: gli indici seguono `w` di PHP.
  const day = (d: number) => new Date(Date.UTC(2024, 0, 7 + d));
  const period = (hour: number) =>
    new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' })
      .formatToParts(new Date(Date.UTC(2024, 0, 1, hour)))
      .find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'am' : 'pm');
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);
  const names: Names = {
    months: range(12).map((m) => pick({ month: 'long' }, month(m))),
    monthsShort: range(12).map((m) => pick({ month: 'short' }, month(m))),
    weekdays: range(7).map((d) => pick({ weekday: 'long' }, day(d))),
    weekdaysShort: range(7).map((d) => pick({ weekday: 'short' }, day(d))),
    am: period(9).toLowerCase(),
    pm: period(21).toLowerCase(),
  };
  namesCache.set(locale, names);
  return names;
}

interface Moment {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  /** Scarto dal tempo universale, in secondi. */
  readonly offset: number;
  readonly epochSeconds: number;
}

/** L'istante nel fuso indicato, con lo scarto calcolato da Intl. */
function momentIn(date: Date, timeZone: string): Moment {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const [year, month, day] = [value('year'), value('month'), value('day')];
  const [hour, minute, second] = [value('hour') % 24, value('minute'), value('second')];
  const epochSeconds = Math.floor(date.getTime() / 1000);
  const local = Date.UTC(year, month - 1, day, hour, minute, second) / 1000;
  return { year, month, day, hour, minute, second, offset: local - epochSeconds, epochSeconds };
}

const pad = (value: number, length = 2) => String(Math.abs(value)).padStart(length, '0');

function offsetText(seconds: number, colon: boolean): string {
  const sign = seconds < 0 ? '-' : '+';
  const minutes = Math.abs(seconds) / 60;
  return `${sign}${pad(Math.floor(minutes / 60))}${colon ? ':' : ''}${pad(minutes % 60)}`;
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Settimana e anno ISO 8601 della data locale (`W` e `o` di PHP). */
function isoWeek(year: number, month: number, day: number): { week: number; year: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const isoYear = date.getUTCFullYear();
  const start = Date.UTC(isoYear, 0, 1);
  return { week: Math.ceil(((date.getTime() - start) / 86_400_000 + 1) / 7), year: isoYear };
}

/** `T` approssimato: l'abbreviazione di Intl se ne ha una («CET», «EST», «UTC»), altrimenti lo scarto («+0530»); in alcuni fusi PHP scrive diversamente («IST», «AEDT», «+04»). */
function zoneAbbreviation(date: Date, timeZone: string, offset: number): string {
  for (const locale of ['en-US', 'en-GB']) {
    const name = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value;
    if (name && !/^(GMT|UTC)[+-]/.test(name)) return name === 'GMT' && offset === 0 ? 'GMT' : name;
  }
  const text = offsetText(offset, false);
  return text.endsWith('00') ? text.slice(0, -2) : text;
}

function englishSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][day % 10] ?? 'th';
}

/**
 * Un istante ISO nel formato di `date()` di PHP, con i nomi della lingua e il fuso
 * del sito; un carattere che PHP non conosce resta com'è, `\` rende letterale il successivo.
 */
export function formatWpDate(
  iso: string,
  format: string,
  options: { readonly locale: string; readonly timeZone: string },
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const names = namesFor(options.locale);
  const m = momentIn(date, options.timeZone);
  const weekday = new Date(Date.UTC(m.year, m.month - 1, m.day)).getUTCDay();
  const dayOfYear = (Date.UTC(m.year, m.month - 1, m.day) - Date.UTC(m.year, 0, 1)) / 86_400_000;
  const hour12 = m.hour % 12 || 12;
  const january = momentIn(new Date(Date.UTC(m.year, 0, 1)), options.timeZone).offset;
  const july = momentIn(new Date(Date.UTC(m.year, 6, 1)), options.timeZone).offset;

  const one = (char: string): string | null => {
    switch (char) {
      case 'd':
        return pad(m.day);
      case 'D':
        return names.weekdaysShort[weekday] ?? '';
      case 'j':
        return String(m.day);
      case 'l':
        return names.weekdays[weekday] ?? '';
      case 'N':
        return String(weekday || 7);
      case 'S':
        return englishSuffix(m.day);
      case 'w':
        return String(weekday);
      case 'z':
        return String(dayOfYear);
      case 'W':
        return pad(isoWeek(m.year, m.month, m.day).week);
      case 'F':
        return names.months[m.month - 1] ?? '';
      case 'm':
        return pad(m.month);
      case 'M':
        return names.monthsShort[m.month - 1] ?? '';
      case 'n':
        return String(m.month);
      case 't':
        return String(new Date(Date.UTC(m.year, m.month, 0)).getUTCDate());
      case 'L':
        return isLeap(m.year) ? '1' : '0';
      case 'o':
        return String(isoWeek(m.year, m.month, m.day).year);
      case 'Y':
        return String(m.year);
      case 'y':
        return pad(m.year % 100);
      case 'a':
        return m.hour < 12 ? names.am : names.pm;
      case 'A':
        return (m.hour < 12 ? names.am : names.pm).toUpperCase();
      case 'B':
        return pad(Math.floor(((((m.epochSeconds + 3600) % 86_400) + 86_400) % 86_400) / 86.4), 3);
      case 'g':
        return String(hour12);
      case 'G':
        return String(m.hour);
      case 'h':
        return pad(hour12);
      case 'H':
        return pad(m.hour);
      case 'i':
        return pad(m.minute);
      case 's':
        return pad(m.second);
      case 'u':
        return '000000';
      case 'v':
        return '000';
      case 'e':
        return options.timeZone;
      case 'I':
        return m.offset > Math.min(january, july) ? '1' : '0';
      case 'O':
        return offsetText(m.offset, false);
      case 'P':
        return offsetText(m.offset, true);
      case 'p':
        return m.offset === 0 ? 'Z' : offsetText(m.offset, true);
      case 'T':
        return zoneAbbreviation(date, options.timeZone, m.offset);
      case 'Z':
        return String(m.offset);
      // WordPress traduce anche i nomi dentro `r` (`wp_date()`), PHP no dentro `c`.
      case 'c':
        return formatWpDate(iso, 'Y-m-d\\TH:i:sP', options);
      case 'r':
        return formatWpDate(iso, 'D, d M Y H:i:s O', options);
      case 'U':
        return String(m.epochSeconds);
      default:
        return null;
    }
  };

  let out = '';
  for (let i = 0; i < format.length; i += 1) {
    const char = format[i] ?? '';
    if (char === '\\' && i + 1 < format.length) {
      i += 1;
      out += format[i] ?? '';
      continue;
    }
    out += one(char) ?? char;
  }
  return out;
}
