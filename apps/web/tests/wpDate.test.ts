import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SITE_DATES,
  formatWpDate,
  htmlLangOf,
  ogLocaleOf,
  siteDatesFrom,
} from '../src/lib/wpDate';

/*
 * DR-270: «Formato data» e «Formato ora» sono stringhe di formato di `date()` di
 * PHP, come in WordPress (`wp_date()`): nomi di mesi e giorni nella lingua del
 * sito, fuso del sito. I nomi italiani sono quelli della traduzione `it_IT` di
 * WordPress della sorgente (`wp-content/languages/it_IT.po`): mesi con
 * l'iniziale maiuscola («Marzo», «Mar»), giorni minuscoli («venerdì») con le
 * abbreviazioni maiuscole («Ven»). Dati sintetici: istanti scelti per cadere a
 * cavallo della mezzanotte di Roma (inverno) e in ora legale (estate).
 */

const ROMA = { locale: 'it-IT', timeZone: 'Europe/Rome' };
/** 2024-03-01 00:05:09 a Roma (CET, +01:00): a UTC è ancora il 29 febbraio. */
const INVERNO = '2024-02-29T23:05:09Z';
/** 2024-07-14 12:00:00 a Roma (CEST, +02:00), domenica. */
const ESTATE = '2024-07-14T10:00:00Z';

const f = (format: string, iso = INVERNO, options = ROMA) => formatWpDate(iso, format, options);

describe('formatWpDate — un carattere di formato per volta, come date() di PHP', () => {
  it.each([
    ['d', '01'],
    ['D', 'Ven'],
    ['j', '1'],
    ['l', 'venerdì'],
    ['N', '5'],
    ['S', 'st'],
    ['w', '5'],
    ['z', '60'],
    ['W', '09'],
    ['F', 'Marzo'],
    ['m', '03'],
    ['M', 'Mar'],
    ['n', '3'],
    ['t', '31'],
    ['L', '1'],
    ['o', '2024'],
    ['Y', '2024'],
    ['y', '24'],
    ['a', 'am'],
    ['A', 'AM'],
    ['B', '003'],
    ['g', '12'],
    ['G', '0'],
    ['h', '12'],
    ['H', '00'],
    ['i', '05'],
    ['s', '09'],
    ['u', '000000'],
    ['v', '000'],
    ['e', 'Europe/Rome'],
    ['I', '0'],
    ['O', '+0100'],
    ['P', '+01:00'],
    ['p', '+01:00'],
    ['T', 'CET'],
    ['Z', '3600'],
    ['c', '2024-03-01T00:05:09+01:00'],
    ['r', 'Ven, 01 Mar 2024 00:05:09 +0100'],
    ['U', '1709247909'],
  ])('«%s» d’inverno a Roma dà «%s»', (format, atteso) => {
    expect(f(format)).toBe(atteso);
  });

  it.each([
    ['D l N w', 'Dom domenica 7 0'],
    ['I T O P Z', '1 CEST +0200 +02:00 7200'],
    ['g G h H a A', '12 12 12 12 pm PM'],
    ['z W t L', '195 28 31 1'],
  ])('«%s» d’estate a Roma dà «%s»', (format, atteso) => {
    expect(f(format, ESTATE)).toBe(atteso);
  });

  it('S segue il numero del giorno in inglese, come PHP e WordPress', () => {
    const giorno = (n: number) => f('jS', `2024-01-${String(n).padStart(2, '0')}T12:00:00Z`);
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(giorno)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '31st',
    ]);
  });

  it('W e o seguono la settimana ISO: il 1° gennaio 2021 è nella settimana 53 del 2020', () => {
    expect(f('W o Y', '2021-01-01T12:00:00Z')).toBe('53 2020 2021');
  });

  it('t e L negli anni non bisestili, g e h nel pomeriggio', () => {
    expect(f('t L', '2023-02-10T12:00:00Z')).toBe('28 0');
    expect(f('g h G H A', '2023-02-10T14:07:00Z')).toBe('3 03 15 15 PM');
  });

  it('la barra rovescia rende letterale il carattere che segue; in fondo resta com’è', () => {
    expect(f('j \\d\\i F')).toBe('1 di Marzo');
    expect(f('\\\\Y')).toBe('\\2024');
    expect(f('Y\\')).toBe('2024\\');
  });

  it('un carattere che date() non conosce resta letterale, come in PHP', () => {
    expect(f('q Q k K f é /,. -')).toBe('q Q k K f é /,. -');
  });

  it('i formati della sorgente: «j F Y» (date_format), «G:i» (time_format), «j M Y» (Divi)', () => {
    expect(f('j F Y')).toBe('1 Marzo 2024');
    expect(f('G:i')).toBe('0:05');
    expect(f('j M Y')).toBe('1 Mar 2024');
  });
});

describe('formatWpDate — fuso e lingua', () => {
  it('il fuso decide il giorno: lo stesso istante è il 29 febbraio a UTC', () => {
    expect(f('j F Y H:i T e', INVERNO, { locale: 'it-IT', timeZone: 'UTC' })).toBe(
      '29 Febbraio 2024 23:05 UTC UTC',
    );
  });

  it('a New York l’abbreviazione è quella di PHP (EST) e lo scarto negativo', () => {
    expect(f('j H:i T O P Z', INVERNO, { locale: 'it-IT', timeZone: 'America/New_York' })).toBe(
      '29 18:05 EST -0500 -05:00 -18000',
    );
  });

  it('T è approssimato: senza abbreviazione in Intl si scrive lo scarto, dove PHP scriverebbe IST o AEDT', () => {
    expect(f('T', INVERNO, { locale: 'it-IT', timeZone: 'Asia/Kolkata' })).toBe('+0530');
    expect(f('T', INVERNO, { locale: 'it-IT', timeZone: 'Australia/Sydney' })).toBe('+11');
    // E al contrario: Intl conosce «GST» per Dubai, PHP scrive «+04».
    expect(f('T', INVERNO, { locale: 'it-IT', timeZone: 'Asia/Dubai' })).toBe('GST');
  });

  it('una lingua senza tabella propria usa Intl per mesi e giorni', () => {
    expect(f('l j F Y, D M', INVERNO, { locale: 'en-US', timeZone: 'Europe/Rome' })).toBe(
      'Friday 1 March 2024, Fri Mar',
    );
  });
});

describe('siteDatesFrom — le impostazioni del sito, lette in modo difensivo', () => {
  it('i valori di oggi danno italiano, Roma, «j F Y»', () => {
    expect(
      siteDatesFrom({
        'site.locale': 'it_IT',
        'site.timezone': 'Europe/Rome',
        'site.date_format': 'j F Y',
        'site.time_format': 'G:i',
      }),
    ).toEqual({ locale: 'it-IT', timeZone: 'Europe/Rome', dateFormat: 'j F Y', timeFormat: 'G:i' });
  });

  it('converte la lingua di WordPress in BCP 47 e prende gli altri valori così come sono', () => {
    expect(
      siteDatesFrom({
        'site.locale': 'de_DE_formal',
        'site.timezone': 'UTC',
        'site.date_format': 'd/m/Y',
        'site.time_format': 'H:i',
      }),
    ).toEqual({ locale: 'de-DE', timeZone: 'UTC', dateFormat: 'd/m/Y', timeFormat: 'H:i' });
  });

  it('prova negativa: valori assenti, vuoti o assurdi non rompono il sito e lasciano i valori di oggi', () => {
    expect(siteDatesFrom({})).toEqual(DEFAULT_SITE_DATES);
    expect(
      siteDatesFrom({
        'site.locale': '',
        'site.timezone': 'Marte/Olimpo',
        'site.date_format': 42,
        'site.time_format': null,
      }),
    ).toEqual(DEFAULT_SITE_DATES);
    expect(siteDatesFrom({ 'site.locale': 'non è una lingua' }).locale).toBe('it-IT');
    // Solo nomi IANA: né scarti né nomi con le maiuscole sbagliate.
    for (const timezone of ['+01:00', 'europe/rome', 'UTC+1', 'Europe/Rome ']) {
      expect(siteDatesFrom({ 'site.timezone': timezone }).timeZone, timezone).toBe('Europe/Rome');
    }
    expect(siteDatesFrom({ 'site.timezone': 'Etc/UTC' }).timeZone).toBe('Etc/UTC');
    expect(siteDatesFrom({ 'site.timezone': 'Europe/Kyiv' }).timeZone).toBe('Europe/Kyiv');
  });

  it('con un formato vuoto la data è vuota, come get_the_date() con date_format vuoto', () => {
    expect(siteDatesFrom({ 'site.date_format': '' }).dateFormat).toBe('');
    expect(f('')).toBe('');
  });
});

describe('lingua dichiarata (DR-270)', () => {
  it('l’attributo lang resta la sola lingua, come oggi («it»)', () => {
    expect(htmlLangOf({ 'site.locale': 'it_IT' })).toBe('it');
    expect(htmlLangOf({ 'site.locale': 'en_US' })).toBe('en');
    expect(htmlLangOf({})).toBe('it');
  });

  it('og:locale nella forma di WordPress («it_IT»), come All in One SEO', () => {
    expect(ogLocaleOf({ 'site.locale': 'it_IT' })).toBe('it_IT');
    expect(ogLocaleOf({ 'site.locale': 'de_DE_formal' })).toBe('de_DE');
    expect(ogLocaleOf({ 'site.locale': '???' })).toBe('it_IT');
  });
});
