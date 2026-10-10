import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { avviaBrowser, nuovoContesto, VIEWPORT } from './condizioni';

/**
 * Lo stile **reso** dell'istanza di riferimento (`1E-W3`,
 * `divi-shortcode-strategy.md` §6): «i design token si estraggono dal CSS reso,
 * non dal tema». Per ogni ruolo di elemento, a ogni viewport, i valori calcolati
 * dal browser, e la regola CSS da cui vengono, così che ogni token del sito nuovo
 * possa citare la sua fonte.
 *
 * Esce solo stile: nessun testo delle pagine.
 */

const RADICE = process.cwd();
const BASE = process.env.WPREF_URL ?? 'http://localhost:8088';
const ESITI = path.join(RADICE, 'docs/qa/stile');

/** Pagine rappresentative: una per template. */
const PAGINE = [
  '/',
  '/chi-siamo/',
  '/contatti/',
  '/servizi/',
  '/category/news/',
  '/dal-prossimo-6-dicembre-la-3a-edizione-del-corso-relazioni-efficaci/',
  '/download/modulo-per-consulenze/',
  '/404-url-inesistente/',
];

/** Ruoli: il nome che userà il sito nuovo, e dove vive nel reso di Divi. */
const RUOLI: Record<string, string> = {
  corpo: 'body',
  intestazione: '#main-header',
  logo: '#logo',
  menu_voce: '#top-menu > li > a',
  menu_voce_attiva: '#top-menu > li.current-menu-item > a',
  menu_sottovoce: '#top-menu .sub-menu a',
  menu_sottomenu: '#top-menu .sub-menu',
  menu_mobile_bottone: '.mobile_menu_bar',
  contenitore: '#main-content .container',
  sezione: '.et_pb_section',
  riga: '.et_pb_row',
  colonna: '.et_pb_column',
  testo: '.et_pb_text_inner',
  titolo_pagina: '.entry-title, .main_title',
  h1: '#main-content h1',
  h2: '#main-content h2',
  h3: '#main-content h3',
  h4: '#main-content h4',
  h5: '#main-content h5',
  h6: '#main-content h6',
  paragrafo: '#main-content p',
  collegamento: '#main-content p a',
  elenco: '#main-content ul',
  voce_elenco: '#main-content ul li',
  bottone: '.et_pb_button',
  immagine: '#main-content img',
  campo: '#main-content input[type="text"], #main-content input[type="email"]',
  area_testo: '#main-content textarea',
  bottone_invio: '.et_pb_contact_submit, button[type="submit"]',
  articolo_elenco: '#left-area article, .et_pb_post',
  articolo_titolo: '.entry-title a',
  articolo_meta: '.post-meta',
  barra_laterale: '#sidebar',
  piede: '#main-footer',
  piede_fondo: '#footer-bottom',
  piede_info: '#footer-info',
};

const PROPRIETA = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-decoration-line',
  'text-align',
  'color',
  'background-color',
  'background-image',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'width',
  'max-width',
  'height',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-bottom-width',
  'border-bottom-color',
  'border-radius',
  'box-shadow',
  'display',
  'position',
];

async function main(): Promise<void> {
  mkdirSync(ESITI, { recursive: true });
  const browser = await avviaBrowser();
  const altri = new Set(['www.centroamorislaetitia.it', 'localhost:8080']);
  const riscrivi = (url: string) => {
    const u = new URL(url);
    return altri.has(u.host) && u.pathname.startsWith('/wp-content/')
      ? `${BASE}${u.pathname}`
      : null;
  };

  const misure: Record<string, Record<string, Record<string, unknown>>> = {};
  const regole: { selettore: string; media: string; proprieta: string; valore: string }[] = [];
  const mediaQuery = new Map<string, number>();

  for (const viewport of VIEWPORT) {
    const context = await nuovoContesto(browser, viewport, riscrivi);
    const page = await context.newPage();
    for (const url of PAGINE) {
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 90_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const valori = await page.evaluate(
        ({ ruoli, proprieta }) => {
          const out: Record<string, unknown> = {};
          for (const [ruolo, selettore] of Object.entries(ruoli)) {
            const tutti = document.querySelectorAll(selettore);
            const el = tutti[0];
            if (!el) continue;
            const stile = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            out[ruolo] = {
              quanti: tutti.length,
              larghezza_resa: Math.round(r.width),
              altezza_resa: Math.round(r.height),
              ...Object.fromEntries(proprieta.map((p) => [p, stile.getPropertyValue(p)])),
            };
          }
          return out;
        },
        { ruoli: RUOLI, proprieta: PROPRIETA },
      );
      (misure[url] ??= {})[viewport.nome] = valori;

      if (viewport.nome === '1440') {
        const testi = await page.evaluate(() => {
          const out: { selettore: string; media: string; proprieta: string; valore: string }[] = [];
          const medie: string[] = [];
          const visita = (lista: CSSRuleList, media: string) => {
            for (const regola of Array.from(lista)) {
              if (regola instanceof CSSMediaRule) {
                medie.push(regola.conditionText);
                visita(regola.cssRules, regola.conditionText);
              } else if (regola instanceof CSSStyleRule) {
                for (const p of Array.from(regola.style)) {
                  if (
                    /^(color|background-color|font-family|font-size|line-height|max-width|width)$/.test(
                      p,
                    )
                  ) {
                    out.push({
                      selettore: regola.selectorText,
                      media,
                      proprieta: p,
                      valore: regola.style.getPropertyValue(p),
                    });
                  }
                }
              }
            }
          };
          for (const foglio of Array.from(document.styleSheets)) {
            try {
              visita(foglio.cssRules, '');
            } catch {
              // Foglio di un'altra origine (Google Fonts): non leggibile, e non serve.
            }
          }
          return { out, medie };
        });
        regole.push(...testi.out);
        for (const m of testi.medie) mediaQuery.set(m, (mediaQuery.get(m) ?? 0) + 1);
      }
    }
    await context.close();
  }

  const uniche = [
    ...new Map(
      regole.map((r) => [`${r.media}|${r.selettore}|${r.proprieta}|${r.valore}`, r]),
    ).values(),
  ];
  writeFileSync(path.join(ESITI, 'calcolati.json'), `${JSON.stringify(misure, null, 1)}\n`);
  writeFileSync(path.join(ESITI, 'regole.json'), `${JSON.stringify(uniche, null, 1)}\n`);
  writeFileSync(
    path.join(ESITI, 'media-query.json'),
    `${JSON.stringify(
      [...mediaQuery]
        .sort((a, b) => b[1] - a[1])
        .map(([condizione, regole]) => ({ condizione, regole })),
      null,
      1,
    )}\n`,
  );
  console.log(`pagine ${PAGINE.length}, viewport ${VIEWPORT.length}, regole ${uniche.length}`);
  await browser.close();
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
