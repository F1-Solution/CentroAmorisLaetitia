import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { avviaBrowser, nuovoContesto, type Viewport } from './condizioni';
import {
  cls,
  confrontaImmagini,
  confrontaPassaggi,
  confrontaStili,
  esitoVoce,
  passaggi,
  type Esito,
  type ImmagineServita,
  type Passo,
  type SpostamentoLayout,
  type Stili,
} from './interazioni';
import { cartellaDi, leggiCsv } from './matrice';

/**
 * T3 della `1E-W7`: voci 1, 2, 3, 5, 6, 7, 8 del §8 sugli 81 URL ad alta
 * priorità, sul sito **e** sul riferimento (D76 = A, DR-166; D78 = A, DR-168).
 *
 *   SITO=http://127.0.0.1:3200 pnpm exec tsx tests/visual/verifica-interazioni.ts
 *
 * Un browser, un URL alla volta, stato su file: interrotto, riparte dall'URL dopo
 * l'ultimo completato (HO-014). Esiti in `docs/qa/verifiche/interazioni.csv`;
 * misure grezze e catture degli stati in `docs/qa/screenshots/verifiche/`,
 * fuori da Git (DR-106). `LIMITE=n` ferma dopo n URL.
 */

const RADICE = process.cwd();
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';
const RIF = process.env.WPREF_URL ?? 'http://localhost:8088';
const LIMITE = Number(process.env.LIMITE ?? Infinity);
const CARTELLA = path.join(RADICE, 'docs/qa/screenshots/verifiche');
const STATO = path.join(CARTELLA, 'stato.json');
const MISURE = path.join(CARTELLA, 'misure.jsonl');
const CSV = path.join(RADICE, 'docs/qa/verifiche/interazioni.csv');
/** Il browser si riavvia ogni tanto: la memoria della macchina è il limite (R7-1). */
const URL_PER_BROWSER = 8;
/** Catture degli stati della testata (uguale ovunque) solo sui primi URL. */
const URL_CON_CATTURE_TESTATA = 3;

/** Come `cattura-riferimento.ts` (DR-111): questi quattro riferimenti vengono dal sito online. */
const ONLINE = 'https://www.centroamorislaetitia.it';
const DA_ONLINE = new Set([
  '/dal-vizioso-al-virtuoso/',
  '/corso-per-consulenti-familiari-vecchia-pagina/',
  '/riparte-il-corso-per-consulenti-familiari/',
  '/i-prossimi-corsi-del-centro/',
]);
const ALTRI_INDIRIZZI = new Set(['www.centroamorislaetitia.it', 'localhost:8080']);

type Lato = 'sito' | 'riferimento';

function baseDi(lato: Lato, url: string): string {
  if (lato === 'sito') return SITO;
  return DA_ONLINE.has(url) ? ONLINE : RIF;
}

function riscritturaDi(lato: Lato, url: string): ((u: string) => string | null) | undefined {
  if (lato === 'sito' || DA_ONLINE.has(url)) return undefined;
  return (richiesta) => {
    const u = new URL(richiesta);
    return ALTRI_INDIRIZZI.has(u.host) && u.pathname.startsWith('/wp-content/')
      ? `${RIF}${u.pathname}`
      : null;
  };
}

const VP = {
  1440: { nome: '1440', width: 1440, height: 900 },
  390: { nome: '390', width: 390, height: 844 },
  360: { nome: '360', width: 360, height: 800 },
} satisfies Record<number, Viewport>;

/** Gli 81 URL: 78 pagine, 2 di sistema (non interattive), 1 di errore. */
function bersagli(): { url: string; tipo: string }[] {
  return leggiCsv(path.join(RADICE, 'docs/migration/url-matrix.csv'))
    .filter((r) => r.priorita_parita === 'alta')
    .map((r) => ({ url: r.url ?? '', tipo: r.tipo ?? '' }));
}

// ── misure nel browser ──────────────────────────────────────────────────────

const PROPRIETA_HOVER = [
  'color',
  'background-color',
  'text-decoration-line',
  'opacity',
  'border-color',
];

const INIT_CLS = `
  window.__ls = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ value: e.value, hadRecentInput: e.hadRecentInput }); })
      .observe({ type: 'layout-shift', buffered: true });
  } catch {}
  const pos = () => {
    const el = document.querySelector('h1') || document.querySelector('#main-content p, main p');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.left + scrollX), Math.round(r.top + scrollY)];
  };
  window.__pos = pos;
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { window.__pos100 = pos(); }, 100));
`;

interface MisuraCaratteri {
  readonly cls: number;
  readonly pos100: number[] | null;
  readonly posFinale: number[] | null;
  readonly errori: string[];
  readonly caricati: number;
}

async function misuraCaratteri(page: Page): Promise<MisuraCaratteri> {
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const w = window as unknown as {
      __ls: SpostamentoLayout[];
      __pos100: number[] | null;
      __pos: () => number[] | null;
    };
    const facce = Array.from(document.fonts);
    return {
      eventi: w.__ls,
      pos100: w.__pos100 ?? null,
      posFinale: w.__pos(),
      errori: facce.filter((f) => f.status === 'error').map((f) => f.family),
      caricati: facce.filter((f) => f.status === 'loaded').length,
    };
  });
  return {
    cls: cls(m.eventi),
    pos100: m.pos100,
    posFinale: m.posFinale,
    errori: m.errori,
    caricati: m.caricati,
  };
}

async function immaginiServite(page: Page): Promise<ImmagineServita[]> {
  return page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
      scrollTo(0, y);
      await new Promise((f) => setTimeout(f, 80));
    }
    await new Promise((f) => setTimeout(f, 500));
    scrollTo(0, 0);
    return Array.from(document.images)
      .filter(
        (i) => i.getBoundingClientRect().width > 0 && (i.currentSrc || i.src) && i.naturalWidth > 0,
      )
      .map((i) => ({ src: i.currentSrc || i.src, naturalWidth: i.naturalWidth }));
  });
}

/** Elementi da passare col puntatore, per categoria e indice: stessi indici sui due lati. */
const CANDIDATI_HOVER: Record<string, string> = {
  menu: '#top-menu > li > a',
  bottone:
    '#main-content .et_pb_button, #main-content .wp-block-button__link, #main-content button[type=submit], #main-content input[type=submit]',
  link: '#main-content p a:not(.et_pb_button), #main-content li a:not(.et_pb_button)',
};

interface MisuraHover {
  readonly chiave: string;
  readonly testo: string;
  readonly prima: Stili;
  readonly dopo: Stili;
}

async function stiliDi(page: Page, selettore: string, indice: number): Promise<Stili | null> {
  return page.evaluate(
    ([sel, i, props]) => {
      const el = Array.from(document.querySelectorAll(sel)).filter(
        (e) => e.getBoundingClientRect().width > 0,
      )[i as number];
      if (!el) return null;
      const cs = getComputedStyle(el);
      return Object.fromEntries((props as string[]).map((p) => [p, cs.getPropertyValue(p)]));
    },
    [selettore, indice, PROPRIETA_HOVER] as const,
  );
}

async function misuraHover(page: Page, catture: string | null): Promise<MisuraHover[]> {
  const out: MisuraHover[] = [];
  for (const [categoria, selettore] of Object.entries(CANDIDATI_HOVER)) {
    const visibili = page.locator(selettore).filter({ visible: true });
    const n = Math.min(await visibili.count(), categoria === 'menu' ? 10 : 3);
    for (let i = 0; i < n; i += 1) {
      const el = visibili.nth(i);
      const prima = await stiliDi(page, selettore, i);
      try {
        await el.scrollIntoViewIfNeeded({ timeout: 3000 });
        await el.hover({ timeout: 3000 });
      } catch {
        continue;
      }
      // Oltre la transizione di 0,4 s delle voci del menu (I1).
      await page.waitForTimeout(500);
      const dopo = await stiliDi(page, selettore, i);
      if (
        catture &&
        i === 0 &&
        (categoria === 'bottone' || (categoria === 'menu' && catture.endsWith('+')))
      ) {
        const box = await el.boundingBox();
        if (box)
          await page.screenshot({
            path: `${catture.replace(/\+$/, '')}-hover-${categoria}.png`,
            clip: {
              x: Math.max(0, box.x - 40),
              y: Math.max(0, box.y - 20),
              width: box.width + 80,
              height: box.height + 40,
            },
          });
      }
      await page.mouse.move(2, 2);
      if (prima && dopo)
        out.push({
          chiave: `${categoria}#${i}`,
          testo: ((await el.textContent()) ?? '').trim().slice(0, 40),
          prima,
          dopo,
        });
    }
  }
  return out;
}

interface MisuraMenu {
  readonly sottomenu: number;
  readonly apertiHover: number;
  readonly terzoLivello: number;
  readonly terzoApertiHover: number;
  readonly chiusiAllUscita: boolean;
  readonly apertiTastiera: number;
}

const VISIBILE_JS = `(el) => {
  if (!el) return false;
  const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
  // checkVisibility considera anche il contenuto di un <details> chiuso.
  return el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && cs.display !== 'none' && r.height > 0;
}`;

async function sottomenuVisibile(_page: Page, li: ReturnType<Page['locator']>): Promise<boolean> {
  return li.evaluate((el) => {
    const ul = el.querySelector(':scope > ul.sub-menu');
    if (!ul) return false;
    const cs = getComputedStyle(ul);
    return (
      cs.display !== 'none' &&
      cs.visibility !== 'hidden' &&
      Number(cs.opacity) > 0 &&
      ul.getBoundingClientRect().height > 0
    );
  });
}

async function misuraMenu(page: Page, cattura: string | null): Promise<MisuraMenu> {
  const primi = page.locator('#top-menu > li.menu-item-has-children');
  const n = await primi.count();
  let apertiHover = 0;
  let terzoLivello = 0;
  let terzoApertiHover = 0;
  let apertiTastiera = 0;
  for (let i = 0; i < n; i += 1) {
    const li = primi.nth(i);
    await li
      .locator(':scope > a')
      .hover({ timeout: 3000 })
      .catch(() => undefined);
    await page.waitForTimeout(250);
    if (await sottomenuVisibile(page, li)) apertiHover += 1;
    if (cattura && i === 0)
      await page.screenshot({
        path: `${cattura}-sottomenu.png`,
        clip: { x: 0, y: 0, width: 1440, height: 600 },
      });
    const terzi = li.locator('ul.sub-menu > li.menu-item-has-children');
    const nt = await terzi.count();
    for (let j = 0; j < nt; j += 1) {
      terzoLivello += 1;
      await terzi
        .nth(j)
        .locator(':scope > a')
        .hover({ timeout: 3000 })
        .catch(() => undefined);
      await page.waitForTimeout(250);
      if (await sottomenuVisibile(page, terzi.nth(j))) terzoApertiHover += 1;
    }
    await page.mouse.move(700, 880);
    await page.waitForTimeout(400);
  }
  const chiusiAllUscita = !(await page
    .locator('#top-menu > li.menu-item-has-children')
    .evaluateAll((lis) =>
      lis.some((li) => {
        const ul = li.querySelector(':scope > ul.sub-menu');
        if (!ul) return false;
        const cs = getComputedStyle(ul);
        return (
          cs.display !== 'none' &&
          cs.visibility !== 'hidden' &&
          Number(cs.opacity) > 0 &&
          ul.getBoundingClientRect().height > 0
        );
      }),
    ));
  for (let i = 0; i < n; i += 1) {
    const li = primi.nth(i);
    await li
      .locator(':scope > a')
      .focus()
      .catch(() => undefined);
    await page.waitForTimeout(250);
    if (await sottomenuVisibile(page, li)) apertiTastiera += 1;
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  return {
    sottomenu: n,
    apertiHover,
    terzoLivello,
    terzoApertiHover,
    chiusiAllUscita,
    apertiTastiera,
  };
}

/** Firma del layout a una larghezza: menu, barra laterale, colonne affiancate (D78 = A). */
const FIRMA_JS = `() => {
  const vis = (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const menu = vis('#top-menu-nav #top-menu') && !vis('.mobile_menu_bar') ? 'menu' : 'hamburger';
  // La sorgente rende la barra anche come modulo Divi in una colonna, il sito come #sidebar.
  const sb = Array.from(document.querySelectorAll('#sidebar, .et_pb_widget_area')).find((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0);
  let barra = 'nessuna';
  if (sb) barra = sb.getBoundingClientRect().left > innerWidth * 0.4 ? 'a-fianco' : 'sotto';
  let colonne = 1;
  for (const row of document.querySelectorAll('#main-content .et_pb_row, #main-content .blk-row, #main-content .wp-block-columns')) {
    const cols = Array.from(row.children).filter((c) => c.matches('.et_pb_column, .blk-column, .wp-block-column') && c.getBoundingClientRect().width > 0);
    if (cols.length < 2) continue;
    const top = cols[0].getBoundingClientRect().top;
    colonne = Math.max(colonne, cols.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 2).length);
  }
  return { firma: menu + '|' + barra + '|col' + colonne, orizzontale: document.documentElement.scrollWidth > innerWidth + 1 };
}`;

interface MisuraPuntiRottura {
  readonly passi: Passo[];
  readonly orizzontale: number[];
}

async function misuraPuntiRottura(page: Page): Promise<MisuraPuntiRottura> {
  const passi: Passo[] = [];
  const orizzontale: number[] = [];
  for (let larghezza = 1440; larghezza >= 360; larghezza -= 10) {
    await page.setViewportSize({ width: larghezza, height: 900 });
    await page.waitForTimeout(120);
    const f = (await page.evaluate(`(${FIRMA_JS})()`)) as { firma: string; orizzontale: boolean };
    passi.push({ larghezza, firma: f.firma });
    if (f.orizzontale) orizzontale.push(larghezza);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  return { passi, orizzontale };
}

interface MisuraMobile {
  readonly aperto: boolean;
  readonly voci: number;
  readonly fuoriSchermo: number;
  readonly ultimaRaggiungibile: boolean;
  readonly chiuso: boolean;
}

async function misuraMobile(
  page: Page,
  larghezza: number,
  cattura: string | null,
): Promise<MisuraMobile | null> {
  const barra = page.locator('.mobile_menu_bar').first();
  if (!(await barra.isVisible().catch(() => false))) return null;
  await barra.click();
  await page.waitForTimeout(900);
  const aperto = (await page.evaluate(
    `(${VISIBILE_JS})(document.querySelector('#et_mobile_nav_menu .et_mobile_menu'))`,
  )) as boolean;
  if (cattura) await page.screenshot({ path: `${cattura}-menu-mobile-${larghezza}.png` });
  const voci = page.locator('#et_mobile_nav_menu .et_mobile_menu li > a').filter({ visible: true });
  const n = await voci.count();
  let fuoriSchermo = 0;
  for (let i = 0; i < n; i += 1) {
    const b = await voci.nth(i).boundingBox();
    if (b && (b.x < -1 || b.x + b.width > larghezza + 1)) fuoriSchermo += 1;
  }
  let ultimaRaggiungibile = n === 0;
  if (n > 0) {
    const ultima = voci.nth(n - 1);
    await ultima.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => undefined);
    const b = await ultima.boundingBox();
    const h = page.viewportSize()?.height ?? 0;
    ultimaRaggiungibile = b !== null && b.y >= 0 && b.y + b.height <= h + 1;
  }
  await page.evaluate(() => scrollTo(0, 0));
  await barra.click().catch(() => undefined);
  await page.waitForTimeout(900);
  const chiuso = !((await page.evaluate(
    `(${VISIBILE_JS})(document.querySelector('#et_mobile_nav_menu .et_mobile_menu'))`,
  )) as boolean);
  return { aperto, voci: n, fuoriSchermo, ultimaRaggiungibile, chiuso };
}

interface MisuraIncorporato {
  readonly tipo: 'video' | 'mappa';
  readonly copertina: boolean;
  readonly iframePrima: boolean;
  readonly iframeDopo: string | null;
}

interface MisuraIncorporati {
  readonly elementi: MisuraIncorporato[];
  /** Solo riferimento: iframe di terzi presenti già al caricamento. */
  readonly iframeTerziAlCaricamento: number;
}

const HOST_ATTESI: Record<MisuraIncorporato['tipo'], RegExp> = {
  video: /^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//,
  mappa: /^https:\/\/(www\.|maps\.)?google\.[a-z.]+\/maps/,
};

async function misuraIncorporati(page: Page, lato: Lato): Promise<MisuraIncorporati> {
  const iframeTerziAlCaricamento = (await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('iframe')).filter((f) =>
        /youtube|vimeo|google\.[a-z.]+\/maps/.test(f.src),
      ).length,
  )) as number;
  if (lato === 'riferimento') {
    const video = await page.locator('.et_pb_video, .wp-block-embed-youtube').count();
    const mappe = await page.locator('.et_pb_map_container').count();
    const elementi: MisuraIncorporato[] = [
      ...Array.from({ length: video }, () => ({
        tipo: 'video' as const,
        copertina: false,
        iframePrima: true,
        iframeDopo: null,
      })),
      ...Array.from({ length: mappe }, () => ({
        tipo: 'mappa' as const,
        copertina: false,
        iframePrima: true,
        iframeDopo: null,
      })),
    ];
    return { elementi, iframeTerziAlCaricamento };
  }
  // Il player non si carica davvero: la verifica guarda solo l'indirizzo dell'iframe creato.
  await page.route(/youtube|vimeo|google\.[a-z.]+\/maps|gstatic|googleapis/, (r) => r.abort());
  const elementi: MisuraIncorporato[] = [];
  for (const [tipo, blocco, copertina] of [
    ['video', '.blk-video', '.blk-video-cover'],
    ['mappa', '.blk-map', '.blk-map-cover'],
  ] as const) {
    const blocchi = page.locator(blocco);
    const n = await blocchi.count();
    for (let i = 0; i < n; i += 1) {
      const b = blocchi.nth(i);
      const haCopertina = (await b.locator(copertina).count()) > 0;
      const iframePrima = (await b.locator('iframe[src]').count()) > 0;
      let iframeDopo: string | null = null;
      if (haCopertina) {
        await b
          .locator(copertina)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
        await b
          .locator(copertina)
          .first()
          .click({ timeout: 3000 })
          .catch(() => undefined);
        await page.waitForTimeout(400);
        iframeDopo =
          (await b
            .locator('iframe')
            .first()
            .getAttribute('src')
            .catch(() => null)) ?? null;
      }
      elementi.push({ tipo, copertina: haCopertina, iframePrima, iframeDopo });
    }
  }
  return { elementi, iframeTerziAlCaricamento };
}

// ── una pagina, un lato ─────────────────────────────────────────────────────

interface Misure {
  readonly stato: number;
  readonly caratteri: MisuraCaratteri;
  readonly immagini1440: ImmagineServita[];
  readonly immagini390: ImmagineServita[];
  readonly hover: MisuraHover[];
  readonly menu: MisuraMenu;
  readonly puntiRottura: MisuraPuntiRottura;
  readonly incorporati: MisuraIncorporati;
  readonly mobile: Record<string, MisuraMobile | null>;
}

const SENZA_TRANSIZIONI =
  '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}';

async function misura(
  browser: Browser,
  lato: Lato,
  url: string,
  catture: string | null,
  testata: boolean,
): Promise<Misure> {
  const indirizzo = `${baseDi(lato, url)}${url}`;
  const ctx = await nuovoContesto(browser, VP[1440], riscritturaDi(lato, url));
  let m: Partial<Misure> = {};
  try {
    await ctx.addInitScript(INIT_CLS);
    const page = await ctx.newPage();
    const risposta = await page.goto(indirizzo, { waitUntil: 'networkidle', timeout: 90_000 });
    const caratteri = await misuraCaratteri(page);
    const immagini1440 = await immaginiServite(page);
    await page.addStyleTag({ content: SENZA_TRANSIZIONI });
    const base = catture ? path.join(catture, lato) : null;
    const hover = await misuraHover(page, base ? (testata ? `${base}+` : base) : null);
    const menu = await misuraMenu(page, base && testata ? base : null);
    const puntiRottura = await misuraPuntiRottura(page);
    const incorporati = await misuraIncorporati(page, lato);
    m = {
      stato: risposta?.status() ?? 0,
      caratteri,
      immagini1440,
      hover,
      menu,
      puntiRottura,
      incorporati,
    };
  } finally {
    await ctx.close();
  }
  const mobile: Record<string, MisuraMobile | null> = {};
  let immagini390: ImmagineServita[] = [];
  for (const vp of [VP[390], VP[360]]) {
    const c = await nuovoContesto(browser, vp, riscritturaDi(lato, url));
    try {
      const page = await c.newPage();
      await page.goto(indirizzo, { waitUntil: 'networkidle', timeout: 90_000 });
      if (vp.width === 390) immagini390 = await immaginiServite(page);
      mobile[vp.nome] = await misuraMobile(
        page,
        vp.width,
        catture && testata ? path.join(catture, lato) : null,
      );
    } finally {
      await c.close();
    }
  }
  return { ...(m as Omit<Misure, 'mobile' | 'immagini390'>), immagini390, mobile };
}

// ── esiti ───────────────────────────────────────────────────────────────────

interface Riga {
  readonly voce: string;
  readonly esito: Esito;
  readonly dettaglio: string;
}

function valutaHover(s: MisuraHover[], r: MisuraHover[]): Riga {
  const rif = new Map(r.map((h) => [h.chiave, h]));
  const scarti: string[] = [];
  let confrontati = 0;
  for (const h of s) {
    const rh = rif.get(h.chiave);
    if (!rh) continue;
    confrontati += 1;
    for (const d of confrontaStili(rh.dopo, h.dopo))
      scarti.push(`${h.chiave} «${h.testo}» ${d.proprieta}: ${d.riferimento} → ${d.sito}`);
  }
  const contiDiversi = ['menu', 'bottone', 'link']
    .map(
      (c) =>
        [
          c,
          s.filter((h) => h.chiave.startsWith(c)).length,
          r.filter((h) => h.chiave.startsWith(c)).length,
        ] as const,
    )
    .filter(([, a, b]) => a !== b)
    .map(([c, a, b]) => `${c}: sito ${a}, riferimento ${b}`);
  if (confrontati === 0)
    return { voce: '1 hover', esito: 'non applicabile', dettaglio: contiDiversi.join('; ') };
  return {
    voce: '1 hover',
    esito: esitoVoce(scarti.length === 0, null),
    dettaglio: [
      `${confrontati} elementi`,
      ...contiDiversi,
      // Il conto per categoria: gli esempi sotto sono solo i primi sei.
      ...['menu', 'bottone', 'link']
        .map((c) => [c, scarti.filter((x) => x.startsWith(c)).length] as const)
        .filter(([, n]) => n > 0)
        .map(([c, n]) => `scarti ${c}: ${n}`),
      ...scarti.slice(0, 6),
    ].join('; '),
  };
}

function menuOk(m: MisuraMenu): boolean {
  return (
    m.apertiHover === m.sottomenu &&
    m.terzoApertiHover === m.terzoLivello &&
    m.chiusiAllUscita &&
    m.apertiTastiera === m.sottomenu
  );
}

function descriviMenu(m: MisuraMenu): string {
  return `hover ${m.apertiHover}/${m.sottomenu}, terzo livello ${m.terzoApertiHover}/${m.terzoLivello}, chiusura ${m.chiusiAllUscita ? 'sì' : 'no'}, tastiera ${m.apertiTastiera}/${m.sottomenu}`;
}

function valutaMenu(s: MisuraMenu, r: MisuraMenu): Riga {
  if (s.sottomenu === 0)
    return { voce: '2 menu', esito: 'non applicabile', dettaglio: 'nessun sottomenu' };
  return {
    voce: '2 menu',
    esito: esitoVoce(menuOk(s), menuOk(r)),
    dettaglio: `sito ${descriviMenu(s)} | riferimento ${descriviMenu(r)}`,
  };
}

function mobileOk(m: MisuraMobile | null, rif: MisuraMobile | null): boolean | null {
  if (!m) return null;
  const voci = rif ? m.voci === rif.voci : true;
  return (
    m.aperto && m.voci > 0 && m.fuoriSchermo === 0 && m.ultimaRaggiungibile && m.chiuso && voci
  );
}

function valutaMobile(s: Misure, r: Misure): Riga {
  const parti: string[] = [];
  const esiti: Esito[] = [];
  for (const vp of ['390', '360']) {
    const ms = s.mobile[vp] ?? null;
    const mr = r.mobile[vp] ?? null;
    esiti.push(esitoVoce(mobileOk(ms, mr), mobileOk(mr, null)));
    const d = (m: MisuraMobile | null) =>
      m
        ? `aperto ${m.aperto ? 'sì' : 'no'}, voci ${m.voci}, fuori ${m.fuoriSchermo}, ultima ${m.ultimaRaggiungibile ? 'sì' : 'no'}, chiuso ${m.chiuso ? 'sì' : 'no'}`
        : 'menu assente';
    parti.push(`${vp}: sito ${d(ms)} | riferimento ${d(mr)}`);
  }
  return { voce: '3 mobile', esito: peggiore(esiti), dettaglio: parti.join('; ') };
}

function caratteriOk(c: MisuraCaratteri): boolean {
  const fermo =
    c.pos100 === null ||
    c.posFinale === null ||
    (c.pos100[0] === c.posFinale[0] && c.pos100[1] === c.posFinale[1]);
  return c.cls === 0 && fermo && c.errori.length === 0;
}

function valutaCaratteri(s: MisuraCaratteri, r: MisuraCaratteri): Riga {
  const d = (c: MisuraCaratteri) =>
    `CLS ${c.cls}, primo testo ${JSON.stringify(c.pos100)}→${JSON.stringify(c.posFinale)}, caricati ${c.caricati}, errori ${c.errori.join('/') || 0}`;
  return {
    voce: '5 caratteri',
    esito: esitoVoce(caratteriOk(s), caratteriOk(r)),
    dettaglio: `sito ${d(s)} | riferimento ${d(r)}`,
  };
}

function valutaImmagini(s: Misure, r: Misure): Riga {
  const parti: string[] = [];
  let ok = true;
  let totale = 0;
  for (const [vp, a, b] of [
    ['1440', s.immagini1440, r.immagini1440],
    ['390', s.immagini390, r.immagini390],
  ] as const) {
    const c = confrontaImmagini(b, a).filter(
      (x) => x.esito !== 'solo riferimento' && x.esito !== 'solo sito',
    );
    totale += c.length;
    const piccole = c.filter((x) => x.esito === 'più piccola');
    const grandi = c.filter((x) => x.esito === 'più grande');
    if (piccole.length > 0) ok = false;
    parti.push(
      `${vp}: ${c.length} confrontate, uguali ${c.filter((x) => x.esito === 'uguale').length}, più grandi ${grandi.length}, più piccole ${piccole.length}` +
        (piccole.length
          ? ` (${piccole
              .slice(0, 3)
              .map((x) => `${x.sito} invece di ${x.riferimento}`)
              .join(', ')})`
          : ''),
    );
  }
  if (totale === 0)
    return {
      voce: '6 immagini',
      esito: 'non applicabile',
      dettaglio: 'nessuna immagine in comune',
    };
  return { voce: '6 immagini', esito: esitoVoce(ok, null), dettaglio: parti.join('; ') };
}

function valutaPuntiRottura(s: MisuraPuntiRottura, r: MisuraPuntiRottura): Riga {
  const scarti = confrontaPassaggi(passaggi(r.passi), passaggi(s.passi));
  const ok = scarti.length === 0 && s.orizzontale.length === 0;
  const rifOk = r.orizzontale.length === 0;
  const fmt = (l: number[]) =>
    l.length === 0 ? '0' : `${l.length} (${l.slice(0, 5).join(', ')}${l.length > 5 ? '…' : ''})`;
  return {
    voce: '7 punti di rottura',
    esito: esitoVoce(ok, scarti.length === 0 ? rifOk : null),
    dettaglio: [
      `passaggi sito ${
        passaggi(s.passi)
          .map((p) => `${p.larghezza}:${p.da}→${p.a}`)
          .join(' ') || 'nessuno'
      }`,
      `scorrimento orizzontale sito ${fmt(s.orizzontale)}, riferimento ${fmt(r.orizzontale)}`,
      ...scarti,
    ].join('; '),
  };
}

function valutaIncorporati(s: MisuraIncorporati, r: MisuraIncorporati): Riga {
  if (s.elementi.length === 0 && r.elementi.length === 0)
    return { voce: '8 incorporati', esito: 'non applicabile', dettaglio: '' };
  const conta = (m: MisuraIncorporati, t: string) => m.elementi.filter((e) => e.tipo === t).length;
  const errati = s.elementi.filter(
    (e) =>
      !e.copertina || e.iframePrima || !e.iframeDopo || !HOST_ATTESI[e.tipo].test(e.iframeDopo),
  );
  const stessiConteggi =
    conta(s, 'video') === conta(r, 'video') && conta(s, 'mappa') === conta(r, 'mappa');
  return {
    voce: '8 incorporati',
    esito: esitoVoce(
      errati.length === 0 && stessiConteggi && s.iframeTerziAlCaricamento === 0,
      null,
    ),
    dettaglio: [
      `sito video ${conta(s, 'video')}, mappe ${conta(s, 'mappa')}; riferimento video ${conta(r, 'video')}, mappe ${conta(r, 'mappa')}`,
      `iframe di terzi al caricamento: sito ${s.iframeTerziAlCaricamento}, riferimento ${r.iframeTerziAlCaricamento}`,
      ...s.elementi.map(
        (e) =>
          `${e.tipo}: copertina ${e.copertina ? 'sì' : 'no'}, iframe prima ${e.iframePrima ? 'sì' : 'no'}, dopo il clic ${e.iframeDopo ?? 'nessuno'}`,
      ),
    ].join('; '),
  };
}

const GRAVITA: Esito[] = [
  'non applicabile',
  'superato',
  'difetto anche nella sorgente',
  'non superato',
];
function peggiore(esiti: Esito[]): Esito {
  return esiti.reduce(
    (a, b) => (GRAVITA.indexOf(b) > GRAVITA.indexOf(a) ? b : a),
    'non applicabile' as Esito,
  );
}

function valuta(s: Misure, r: Misure): Riga[] {
  return [
    valutaHover(s.hover, r.hover),
    valutaMenu(s.menu, r.menu),
    valutaMobile(s, r),
    valutaCaratteri(s.caratteri, r.caratteri),
    valutaImmagini(s, r),
    valutaPuntiRottura(s.puntiRottura, r.puntiRottura),
    valutaIncorporati(s.incorporati, r.incorporati),
  ];
}

// ── esecuzione ──────────────────────────────────────────────────────────────

const cella = (v: string) => `"${v.replaceAll('"', '""')}"`;

function leggiStato(): Set<string> {
  if (!existsSync(STATO)) return new Set();
  return new Set((JSON.parse(readFileSync(STATO, 'utf-8')) as { fatti: string[] }).fatti);
}

/** `RICALCOLA=1`: esiti riscritti dalle misure già salvate, senza browser, nell'ordine della matrice. */
function ricalcola(): void {
  const misure = new Map(
    readFileSync(MISURE, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { url: string; sito: Misure; rif: Misure })
      .map((m) => [m.url, m]),
  );
  let csv = 'url,voce,esito,dettaglio\n';
  for (const b of bersagli()) {
    if (b.tipo === 'sistema') {
      csv += `${cella(b.url)},${cella('tutte')},${cella('non applicabile')},${cella('indirizzo di sistema, senza interazioni')}\n`;
      continue;
    }
    const m = misure.get(b.url);
    if (!m) throw new Error(`misure mancanti per ${b.url}`);
    for (const r of valuta(m.sito, m.rif))
      csv += `${cella(b.url)},${cella(r.voce)},${cella(r.esito)},${cella(r.dettaglio)}\n`;
  }
  writeFileSync(CSV, csv);
  console.log(`interazioni: esiti ricalcolati per ${misure.size} URL`);
}

async function main(): Promise<void> {
  if (process.env.RICALCOLA === '1') return ricalcola();
  mkdirSync(CARTELLA, { recursive: true });
  mkdirSync(path.dirname(CSV), { recursive: true });
  const fatti = leggiStato();
  if (!existsSync(CSV)) writeFileSync(CSV, 'url,voce,esito,dettaglio\n');
  const tutti = bersagli();
  const daFare = tutti.filter((b) => !fatti.has(b.url));
  console.log(
    `interazioni: ${tutti.length} URL, ${fatti.size} già fatti, ${daFare.length} da fare`,
  );
  let browser: Browser | null = null;
  let eseguiti = 0;
  try {
    for (const [i, b] of daFare.entries()) {
      if (eseguiti >= LIMITE) break;
      if (b.tipo === 'sistema') {
        appendFileSync(
          CSV,
          `${cella(b.url)},${cella('tutte')},${cella('non applicabile')},${cella('indirizzo di sistema, senza interazioni')}\n`,
        );
      } else {
        if (!browser || eseguiti % URL_PER_BROWSER === 0) {
          await browser?.close();
          browser = await avviaBrowser();
        }
        const posizione = tutti.findIndex((t) => t.url === b.url);
        const catture = path.join(CARTELLA, cartellaDi(b.url));
        mkdirSync(catture, { recursive: true });
        const testata = posizione < URL_CON_CATTURE_TESTATA;
        try {
          const sito = await misura(browser, 'sito', b.url, catture, testata);
          const rif = await misura(browser, 'riferimento', b.url, catture, testata);
          appendFileSync(MISURE, `${JSON.stringify({ url: b.url, sito, rif })}\n`);
          for (const r of valuta(sito, rif))
            appendFileSync(
              CSV,
              `${cella(b.url)},${cella(r.voce)},${cella(r.esito)},${cella(r.dettaglio)}\n`,
            );
        } catch (errore) {
          console.log(
            `  ${b.url}: errore ${(errore as Error).message.split('\n')[0]}; si riprova al prossimo avvio`,
          );
          await browser.close().catch(() => undefined);
          browser = null;
          eseguiti += 1;
          continue;
        }
      }
      fatti.add(b.url);
      writeFileSync(STATO, JSON.stringify({ fatti: [...fatti] }, null, 1));
      eseguiti += 1;
      console.log(
        `  [${fatti.size}/${tutti.length}] ${b.url} (${i + 1}/${daFare.length} di questo avvio)`,
      );
    }
  } finally {
    await browser?.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
