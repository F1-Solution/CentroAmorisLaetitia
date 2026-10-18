import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import {
  etichettaMancante,
  inversioniOrdine,
  saltiTitoli,
  type Etichette,
  type Punto,
} from './accessibilita';
import { avviaBrowser } from './condizioni';
import { esitoVoce, type Esito } from './interazioni';
import { leggiCsv } from './matrice';

/**
 * T4 della `1E-W7`: A-1…A-7 e voce 4 del §8 (form) sugli 81 URL ad alta priorità.
 *
 *   SITO=http://127.0.0.1:3200 pnpm exec tsx tests/visual/verifica-accessibilita.ts
 *
 * Ogni criterio si misura anche sul riferimento, per separare i difetti ereditati
 * (D79 = A, DR-169). I form si inviano **solo sul sito**, con dati sintetici e
 * nessuna email (DR-108): sul riferimento si prova soltanto l'invio vuoto, con
 * ogni richiesta che non sia GET bloccata, perché l'istanza resta congelata.
 * Un browser, un URL alla volta, ripresa da `stato-accessibilita.json` (HO-014).
 */

const RADICE = process.cwd();
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';
const RIF = process.env.WPREF_URL ?? 'http://localhost:8088';
const LIMITE = Number(process.env.LIMITE ?? Infinity);
/** `SOLO=/percorso/`: un solo URL, per le prove. */
const SOLO = process.env.SOLO;
const CARTELLA = path.join(RADICE, 'docs/qa/screenshots/verifiche');
const STATO = process.env.STATO ?? path.join(CARTELLA, 'stato-accessibilita.json');
const MISURE = process.env.MISURE ?? path.join(CARTELLA, 'misure-accessibilita.jsonl');
const CSV = process.env.CSV ?? path.join(RADICE, 'docs/qa/verifiche/accessibilita.csv');
const URL_PER_BROWSER = 8;
const MAX_TAB = 400;

/** Come `cattura-riferimento.ts` (DR-111). Per i form questi quattro non si provano sul riferimento: è il sito online. */
const ONLINE = 'https://www.centroamorislaetitia.it';
const DA_ONLINE = new Set([
  '/dal-vizioso-al-virtuoso/',
  '/corso-per-consulenti-familiari-vecchia-pagina/',
  '/riparte-il-corso-per-consulenti-familiari/',
  '/i-prossimi-corsi-del-centro/',
]);
const ALTRI_INDIRIZZI = new Set(['www.centroamorislaetitia.it', 'localhost:8080']);

type Lato = 'sito' | 'riferimento';

function bersagli(): { url: string; tipo: string }[] {
  return leggiCsv(path.join(RADICE, 'docs/migration/url-matrix.csv'))
    .filter((r) => r.priorita_parita === 'alta')
    .map((r) => ({ url: r.url ?? '', tipo: r.tipo ?? '' }));
}

async function contesto(
  browser: Browser,
  lato: Lato,
  url: string,
  width: number,
  height: number,
): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    serviceWorkers: 'block',
  });
  await ctx.addInitScript('window.__name = (f) => f');
  const online = lato === 'riferimento' && DA_ONLINE.has(url);
  const origine = new URL(lato === 'sito' ? SITO : online ? ONLINE : RIF).host;
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    try {
      const u = new URL(req.url());
      // Il riferimento non si modifica: nessun invio, nemmeno per sbaglio.
      if (lato === 'riferimento' && req.method() !== 'GET') return await route.abort();
      if (
        lato === 'riferimento' &&
        !online &&
        ALTRI_INDIRIZZI.has(u.host) &&
        u.pathname.startsWith('/wp-content/')
      ) {
        const r = await ctx.request.get(`${RIF}${u.pathname}`);
        return await route.fulfill({
          response: r,
          headers: { ...r.headers(), 'access-control-allow-origin': '*' },
        });
      }
      // Nessuna chiamata a terzi (pagamento, analisi): la verifica resta in locale.
      if (u.host !== origine && !(online && u.host.endsWith('centroamorislaetitia.it')))
        return await route.abort();
      return await route.continue();
    } catch {
      // pagina chiusa
    }
  });
  return ctx;
}

function indirizzo(lato: Lato, url: string): string {
  return `${lato === 'sito' ? SITO : DA_ONLINE.has(url) ? ONLINE : RIF}${url}`;
}

// ── A-1, A-2: tastiera e fuoco ──────────────────────────────────────────────

interface Passo extends Punto {
  readonly descrizione: string;
  readonly indicatore: boolean;
  readonly sottomenu: boolean;
}

interface MisuraFuoco {
  readonly interattivi: number;
  readonly raggiunti: number;
  readonly nonRaggiunti: string[];
  readonly trappola: boolean;
  readonly senzaIndicatore: string[];
  readonly inversioni: string[];
}

const STILI_FUOCO = [
  'outline-style',
  'outline-width',
  'outline-color',
  'box-shadow',
  'border-color',
  'background-color',
  'color',
  'text-decoration-line',
];

async function misuraFuoco(page: Page): Promise<MisuraFuoco> {
  // Ogni elemento interattivo visibile riceve un numero, per riconoscerlo durante il giro.
  const interattivi = await page.evaluate(() => {
    const sel =
      'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    let n = 0;
    // In un gruppo di opzioni Tab raggiunge un solo pulsante; gli altri si scelgono con le frecce.
    const gruppi = new Set<string>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
        if (gruppi.has(el.name)) continue;
        gruppi.add(el.name);
      }
      const disabilitato =
        (el as HTMLButtonElement).disabled || el.getAttribute('tabindex') === '-1';
      if (disabilitato || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
        continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      el.dataset.a11y = String(n);
      n += 1;
    }
    return n;
  });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    scrollTo(0, 0);
  });
  const visti = new Set<string>();
  const passi: Passo[] = [];
  let primo: string | null = null;
  let trappola = true;
  for (let i = 0; i < MAX_TAB; i += 1) {
    await page.keyboard.press('Tab');
    const p = (await page.evaluate((props) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const stile = (e: HTMLElement) => {
        const cs = getComputedStyle(e);
        return props.map((k) => cs.getPropertyValue(k)).join('|');
      };
      const conFuoco = stile(el);
      // Lo stesso elemento senza fuoco: un cambio di stile misurabile è l'indicatore (A-2).
      el.blur();
      const senza = stile(el);
      el.focus({ preventScroll: true });
      const testo = (
        el.getAttribute('aria-label') ||
        el.textContent ||
        el.getAttribute('value') ||
        el.tagName
      )
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      return {
        id: el.dataset.a11y ?? `fuori:${el.tagName.toLowerCase()}`,
        descrizione: `${el.tagName.toLowerCase()} «${testo}»`,
        x: Math.round(r.left + scrollX),
        y: Math.round(r.top + scrollY),
        indicatore: conFuoco !== senza,
        sottomenu: !!el.closest('.sub-menu'),
      };
    }, STILI_FUOCO)) as (Passo & { id: string }) | null;
    if (p === null) {
      // Il fuoco è uscito dalla pagina: il giro si è chiuso senza trappole.
      if (passi.length > 0) {
        trappola = false;
        break;
      }
      continue;
    }
    if (primo === null) primo = p.id;
    else if (p.id === primo) {
      trappola = false;
      break;
    }
    visti.add(p.id);
    passi.push(p);
  }
  const nonRaggiunti = (await page.evaluate(
    (vistiIds) =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-a11y]'))
        .filter((e) => !vistiIds.includes(e.dataset.a11y ?? ''))
        .map(
          (e) =>
            `${e.tagName.toLowerCase()} «${(e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30)}»`,
        ),
    [...visti],
  )) as string[];
  // Le voci di un sottomenu stanno sotto la loro voce e risalgono alla successiva: ordine del DOM, non un'inversione.
  const ordinati = passi.filter((p) => p.y >= 0 && !p.sottomenu);
  const inv = inversioniOrdine(ordinati);
  return {
    interattivi,
    raggiunti: [...visti].filter((v) => !v.startsWith('fuori:')).length,
    nonRaggiunti,
    trappola,
    senzaIndicatore: passi.filter((p) => !p.indicatore).map((p) => p.descrizione),
    inversioni: inv.map((i) => `${ordinati[i - 1]!.descrizione} → ${ordinati[i]!.descrizione}`),
  };
}

// ── A-3: menu mobile da tastiera ────────────────────────────────────────────

interface MisuraTastieraMobile {
  readonly raggiungibile: boolean;
  readonly apreInvio: boolean;
  readonly chiudeEsc: boolean;
  readonly apreSpazio: boolean;
}

async function menuAperto(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const m = document.querySelector<HTMLElement>('#et_mobile_nav_menu .et_mobile_menu');
    return (
      !!m &&
      m.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
      m.getBoundingClientRect().height > 0
    );
  });
}

async function misuraTastieraMobile(page: Page): Promise<MisuraTastieraMobile> {
  let raggiungibile = false;
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    raggiungibile = await page.evaluate(
      () =>
        !!document.activeElement?.closest('#et_mobile_nav_menu') &&
        !document.activeElement?.closest('.et_mobile_menu'),
    );
    if (raggiungibile) break;
  }
  if (!raggiungibile)
    return { raggiungibile, apreInvio: false, chiudeEsc: false, apreSpazio: false };
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  const apreInvio = await menuAperto(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const chiudeEsc = apreInvio && !(await menuAperto(page));
  if (await menuAperto(page)) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
  }
  await page.keyboard.press(' ');
  await page.waitForTimeout(800);
  const apreSpazio = await menuAperto(page);
  return { raggiungibile, apreInvio, chiudeEsc, apreSpazio };
}

// ── A-4…A-7: struttura ──────────────────────────────────────────────────────

interface MisuraStruttura {
  readonly immaginiSenzaAlt: string[];
  readonly immaginiAltVuoto: string[];
  readonly campiSenzaEtichetta: string[];
  readonly campiTotali: number;
  readonly lang: string;
  readonly h1: number;
  readonly salti: string[];
}

async function misuraStruttura(page: Page): Promise<MisuraStruttura> {
  const m = await page.evaluate(() => {
    const nome = (s: string) => decodeURIComponent(s.split(/[?#]/)[0]!.split('/').pop() ?? s);
    const imgs = Array.from(document.images).filter(
      (i) => i.getBoundingClientRect().width > 0 || i.closest('#main-content'),
    );
    const campi = Array.from(
      document.querySelectorAll<HTMLInputElement>('input, select, textarea'),
    ).filter(
      (c) =>
        !['hidden', 'submit', 'button', 'reset', 'image'].includes(c.type) &&
        !c.closest('[aria-hidden="true"]'),
    );
    return {
      senzaAlt: imgs.filter((i) => !i.hasAttribute('alt')).map((i) => nome(i.currentSrc || i.src)),
      altVuoto: imgs
        .filter((i) => i.getAttribute('alt')?.trim() === '')
        .map((i) => nome(i.currentSrc || i.src)),
      campi: campi.map((c) => ({
        descrizione: `${c.tagName.toLowerCase()}[${c.name || c.id || c.type}]`,
        labelFor: !!c.id && !!document.querySelector(`label[for="${CSS.escape(c.id)}"]`),
        labelContenitore: !!c.closest('label'),
        ariaLabel: c.getAttribute('aria-label') ?? '',
        ariaLabelledby: c.getAttribute('aria-labelledby') ?? '',
      })),
      lang: document.documentElement.lang,
      livelli: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .filter((h) => (h as HTMLElement).checkVisibility())
        .map((h) => Number(h.tagName[1])),
    };
  });
  return {
    immaginiSenzaAlt: m.senzaAlt,
    immaginiAltVuoto: m.altVuoto,
    campiSenzaEtichetta: m.campi
      .filter((c: Etichette & { descrizione: string }) => etichettaMancante(c))
      .map((c) => c.descrizione),
    campiTotali: m.campi.length,
    lang: m.lang,
    h1: m.livelli.filter((l) => l === 1).length,
    salti: saltiTitoli(m.livelli),
  };
}

// ── voce 4: form ────────────────────────────────────────────────────────────

interface MisuraForm {
  readonly indice: number;
  readonly vuotoMessaggi: boolean;
  readonly sinteticoConferma: boolean | null;
  readonly nota: string;
}

const FORM = '#main-content form, .entry-content form';

/** Valori sintetici per tipo di campo: nessun dato reale (CLAUDE.md, privacy). */
async function compilaSintetico(page: Page, form: ReturnType<Page['locator']>): Promise<string[]> {
  const saltati: string[] = [];
  const campi = form.locator('input, select, textarea');
  const n = await campi.count();
  for (let i = 0; i < n; i += 1) {
    const c = campi.nth(i);
    if (!(await c.isVisible().catch(() => false))) continue;
    // Il campo esca (ADR-010) resta vuoto, come lo lascia una persona.
    if (await c.evaluate((e) => !!e.closest('[aria-hidden="true"], .blk-form-trap'))) continue;
    const tipo = (
      (await c.getAttribute('type')) ?? (await c.evaluate((e) => e.tagName.toLowerCase()))
    ).toLowerCase();
    const nome = (await c.getAttribute('name')) ?? (await c.getAttribute('id')) ?? tipo;
    try {
      if (tipo === 'select') {
        const valori = await c
          .locator('option')
          .evaluateAll((os) =>
            os.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== ''),
          );
        if (valori[0]) await c.selectOption(valori[0]);
      } else if (tipo === 'checkbox') await c.check({ force: true });
      else if (tipo === 'radio') {
        const gruppo = await c.getAttribute('name');
        const gia = gruppo
          ? await form.locator(`input[type=radio][name="${gruppo}"]:checked`).count()
          : 0;
        if (gia === 0) await c.check({ force: true });
      } else if (tipo === 'file') saltati.push(nome);
      else if (['submit', 'button', 'hidden', 'reset'].includes(tipo)) continue;
      else {
        const valore =
          tipo === 'email'
            ? 'prova.sintetica@example.invalid'
            : tipo === 'tel'
              ? '3330000000'
              : tipo === 'number'
                ? '1'
                : tipo === 'date'
                  ? '2030-01-15'
                  : tipo === 'url'
                    ? 'https://example.invalid'
                    : tipo === 'textarea'
                      ? 'Messaggio sintetico della verifica 1E-W7.'
                      : /codice.?fiscale|cf\b/i.test(nome)
                        ? 'RSSMRA80A01H501U'
                        : /cap\b|postal/i.test(nome)
                          ? '05100'
                          : 'Prova Sintetica';
        await c.fill(valore);
      }
    } catch {
      saltati.push(nome);
    }
  }
  return saltati;
}

async function messaggiVisibili(page: Page, form: ReturnType<Page['locator']>): Promise<boolean> {
  return page.evaluate(
    (el) => {
      const contenitore =
        (el as HTMLElement).closest(
          '.blk, .et_pb_contact_form_container, .wpforms-container, .et_pb_module',
        ) ?? (el as HTMLElement);
      const sel =
        '[role=alert], .blk-form-error, .wpforms-error, label.error, .et-pb-contact-message p, .et_contact_error, [aria-invalid=true]';
      return Array.from(contenitore.querySelectorAll<HTMLElement>(sel)).some(
        (m) => m.checkVisibility() && (m.textContent?.trim() || m.getAttribute('aria-invalid')),
      );
    },
    await form.elementHandle(),
  );
}

async function misuraForm(browser: Browser, lato: Lato, url: string): Promise<MisuraForm[]> {
  const out: MisuraForm[] = [];
  for (let indice = 0; ; indice += 1) {
    const ctx = await contesto(browser, lato, url, 1440, 900);
    try {
      const page = await ctx.newPage();
      await page.goto(indirizzo(lato, url), { waitUntil: 'networkidle', timeout: 90_000 });
      const forms = page.locator(FORM).filter({ has: page.locator('[type=submit], button') });
      if (indice >= (await forms.count())) break;
      const form = forms.nth(indice);
      const invio = form
        .locator('[type=submit], button[type=submit], button.et_pb_contact_submit')
        .first();
      // Il tempo minimo di compilazione del campo esca (ADR-010): si attende come una persona.
      await page.waitForTimeout(4000);
      await invio.scrollIntoViewIfNeeded().catch(() => undefined);
      await invio.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      const vuotoMessaggi = await messaggiVisibili(page, form);
      if (lato === 'riferimento') {
        out.push({
          indice,
          vuotoMessaggi,
          sinteticoConferma: null,
          nota: 'invio sintetico non eseguito sul riferimento',
        });
        continue;
      }
      await page.reload({ waitUntil: 'networkidle' });
      const f2 = page
        .locator(FORM)
        .filter({ has: page.locator('[type=submit], button') })
        .nth(indice);
      const saltati = await compilaSintetico(page, f2);
      await page.waitForTimeout(4000);
      await f2
        .locator('[type=submit], button[type=submit], button.et_pb_contact_submit')
        .first()
        .click({ timeout: 5000 })
        .catch(() => undefined);
      await page.waitForTimeout(2500);
      const conferma = await page
        .locator('.blk-form-confirmation')
        .filter({ visible: true })
        .count();
      const errore =
        (await page
          .locator('.blk-form-error')
          .first()
          .textContent()
          .catch(() => null)) ?? '';
      out.push({
        indice,
        vuotoMessaggi,
        sinteticoConferma: conferma > 0,
        nota: [
          saltati.length ? `campi non compilati: ${saltati.join(', ')}` : '',
          errore ? `errore: ${errore.trim().slice(0, 120)}` : '',
        ]
          .filter(Boolean)
          .join('; '),
      });
    } finally {
      await ctx.close();
    }
  }
  return out;
}

// ── una pagina ──────────────────────────────────────────────────────────────

interface Misure {
  readonly fuoco: MisuraFuoco;
  readonly struttura: MisuraStruttura;
  readonly mobile: Record<string, MisuraTastieraMobile>;
  readonly form: MisuraForm[];
}

async function misura(browser: Browser, lato: Lato, url: string): Promise<Misure> {
  const ctx = await contesto(browser, lato, url, 1440, 900);
  let fuoco: MisuraFuoco;
  let struttura: MisuraStruttura;
  try {
    const page = await ctx.newPage();
    await page.goto(indirizzo(lato, url), { waitUntil: 'networkidle', timeout: 90_000 });
    struttura = await misuraStruttura(page);
    fuoco = await misuraFuoco(page);
  } finally {
    await ctx.close();
  }
  const mobile: Record<string, MisuraTastieraMobile> = {};
  for (const [w, h] of [
    [390, 844],
    [360, 800],
  ] as const) {
    const c = await contesto(browser, lato, url, w, h);
    try {
      const page = await c.newPage();
      await page.goto(indirizzo(lato, url), { waitUntil: 'networkidle', timeout: 90_000 });
      mobile[String(w)] = await misuraTastieraMobile(page);
    } finally {
      await c.close();
    }
  }
  // `SENZA_FORM=1`: si rimisura il resto senza inviare di nuovo i form (nessuna compilazione in più).
  const form = process.env.SENZA_FORM === '1' ? [] : await misuraForm(browser, lato, url);
  return { fuoco, struttura, mobile, form };
}

// ── esiti ───────────────────────────────────────────────────────────────────

interface Riga {
  readonly criterio: string;
  readonly esito: Esito;
  readonly dettaglio: string;
}

const elenco = (l: string[], n = 5) =>
  l.length === 0 ? '' : `${l.slice(0, n).join(', ')}${l.length > n ? ` (+${l.length - n})` : ''}`;

function valuta(s: Misure, r: Misure): Riga[] {
  const a1 = (m: MisuraFuoco) => !m.trappola && m.nonRaggiunti.length === 0;
  const a2 = (m: MisuraFuoco) => m.senzaIndicatore.length === 0 && m.inversioni.length === 0;
  const a3 = (m: MisuraTastieraMobile) =>
    m.raggiungibile && m.apreInvio && m.chiudeEsc && m.apreSpazio;
  const descriviA3 = (m: Record<string, MisuraTastieraMobile>) =>
    Object.entries(m)
      .map(
        ([w, x]) =>
          `${w}: raggiungibile ${x.raggiungibile ? 'sì' : 'no'}, Invio ${x.apreInvio ? 'sì' : 'no'}, Esc ${x.chiudeEsc ? 'sì' : 'no'}, Spazio ${x.apreSpazio ? 'sì' : 'no'}`,
      )
      .join('; ');
  const a7 = (m: MisuraStruttura) => m.h1 === 1 && m.salti.length === 0;
  const righe: Riga[] = [
    {
      criterio: 'A-1 tastiera',
      esito: esitoVoce(a1(s.fuoco), a1(r.fuoco)),
      dettaglio: `sito ${s.fuoco.raggiunti}/${s.fuoco.interattivi} raggiunti, trappola ${s.fuoco.trappola ? 'sì' : 'no'}${s.fuoco.nonRaggiunti.length ? `, non raggiunti: ${elenco(s.fuoco.nonRaggiunti)}` : ''} | riferimento ${r.fuoco.raggiunti}/${r.fuoco.interattivi}, trappola ${r.fuoco.trappola ? 'sì' : 'no'}`,
    },
    {
      criterio: 'A-2 fuoco visibile e ordine',
      esito: esitoVoce(a2(s.fuoco), a2(r.fuoco)),
      dettaglio: `sito senza indicatore ${s.fuoco.senzaIndicatore.length}${s.fuoco.senzaIndicatore.length ? ` (${elenco(s.fuoco.senzaIndicatore, 3)})` : ''}, inversioni ${s.fuoco.inversioni.length}${s.fuoco.inversioni.length ? ` (${elenco(s.fuoco.inversioni, 3)})` : ''} | riferimento senza indicatore ${r.fuoco.senzaIndicatore.length}, inversioni ${r.fuoco.inversioni.length}`,
    },
    {
      criterio: 'A-3 menu mobile da tastiera',
      esito: esitoVoce(Object.values(s.mobile).every(a3), Object.values(r.mobile).every(a3)),
      dettaglio: `sito ${descriviA3(s.mobile)} | riferimento ${descriviA3(r.mobile)}`,
    },
    {
      criterio: 'A-4 testi alternativi',
      esito: esitoVoce(
        s.struttura.immaginiSenzaAlt.length === 0,
        r.struttura.immaginiSenzaAlt.length === 0,
      ),
      dettaglio: `sito senza alt ${s.struttura.immaginiSenzaAlt.length}${s.struttura.immaginiSenzaAlt.length ? ` (${elenco(s.struttura.immaginiSenzaAlt)})` : ''}, alt vuoto da rivedere ${s.struttura.immaginiAltVuoto.length}${s.struttura.immaginiAltVuoto.length ? ` (${elenco(s.struttura.immaginiAltVuoto)})` : ''} | riferimento senza alt ${r.struttura.immaginiSenzaAlt.length}, alt vuoto ${r.struttura.immaginiAltVuoto.length}`,
    },
    {
      criterio: 'A-5 etichette dei campi',
      esito:
        s.struttura.campiTotali === 0
          ? 'non applicabile'
          : esitoVoce(
              s.struttura.campiSenzaEtichetta.length === 0,
              r.struttura.campiSenzaEtichetta.length === 0,
            ),
      dettaglio: `sito ${s.struttura.campiSenzaEtichetta.length}/${s.struttura.campiTotali} senza etichetta${s.struttura.campiSenzaEtichetta.length ? ` (${elenco(s.struttura.campiSenzaEtichetta)})` : ''} | riferimento ${r.struttura.campiSenzaEtichetta.length}/${r.struttura.campiTotali}`,
    },
    {
      criterio: 'A-6 lingua',
      esito: esitoVoce(
        s.struttura.lang === 'it' || s.struttura.lang.startsWith('it-'),
        r.struttura.lang.startsWith('it'),
      ),
      dettaglio: `sito «${s.struttura.lang}» | riferimento «${r.struttura.lang}»`,
    },
    {
      criterio: 'A-7 titoli',
      esito: esitoVoce(a7(s.struttura), a7(r.struttura)),
      dettaglio: `sito h1 ${s.struttura.h1}, salti ${elenco(s.struttura.salti) || 0} | riferimento h1 ${r.struttura.h1}, salti ${elenco(r.struttura.salti) || 0}`,
    },
  ];
  if (s.form.length === 0 && r.form.length === 0)
    righe.push({ criterio: '§8 voce 4 form', esito: 'non applicabile', dettaglio: '' });
  for (const f of s.form) {
    const rf = r.form.find((x) => x.indice === f.indice);
    righe.push({
      criterio: `§8 voce 4 form ${f.indice + 1}`,
      esito: esitoVoce(
        f.vuotoMessaggi && f.sinteticoConferma === true,
        rf ? rf.vuotoMessaggi : null,
      ),
      dettaglio: `sito: invio vuoto con messaggi ${f.vuotoMessaggi ? 'sì' : 'no'}, invio sintetico confermato ${f.sinteticoConferma ? 'sì' : 'no'}${f.nota ? `, ${f.nota}` : ''} | riferimento: invio vuoto con messaggi ${rf ? (rf.vuotoMessaggi ? 'sì' : 'no') : 'form assente'}`,
    });
  }
  if (r.form.length > s.form.length)
    righe.push({
      criterio: '§8 voce 4 form',
      esito: 'non superato',
      dettaglio: `form sul riferimento ${r.form.length}, sul sito ${s.form.length}`,
    });
  return righe;
}

// ── esecuzione ──────────────────────────────────────────────────────────────

const cella = (v: string) => `"${v.replaceAll('"', '""')}"`;

async function main(): Promise<void> {
  mkdirSync(CARTELLA, { recursive: true });
  const fatti = new Set<string>(
    existsSync(STATO)
      ? (JSON.parse(readFileSync(STATO, 'utf-8')) as { fatti: string[] }).fatti
      : [],
  );
  if (!existsSync(CSV)) writeFileSync(CSV, 'url,criterio,esito,dettaglio\n');
  const tutti = bersagli();
  const daFare = tutti.filter((b) => !fatti.has(b.url) && (!SOLO || b.url === SOLO));
  console.log(
    `accessibilità: ${tutti.length} URL, ${fatti.size} già fatti, ${daFare.length} da fare`,
  );
  let browser: Browser | null = null;
  let eseguiti = 0;
  try {
    for (const b of daFare) {
      if (eseguiti >= LIMITE) break;
      if (b.tipo === 'sistema') {
        appendFileSync(
          CSV,
          `${cella(b.url)},${cella('tutti')},${cella('non applicabile')},${cella('indirizzo di sistema, non è una pagina')}\n`,
        );
      } else {
        if (!browser || eseguiti % URL_PER_BROWSER === 0) {
          await browser?.close();
          browser = await avviaBrowser();
        }
        try {
          const sito = await misura(browser, 'sito', b.url);
          const rif = await misura(browser, 'riferimento', b.url);
          appendFileSync(MISURE, `${JSON.stringify({ url: b.url, sito, rif })}\n`);
          for (const r of valuta(sito, rif))
            appendFileSync(
              CSV,
              `${cella(b.url)},${cella(r.criterio)},${cella(r.esito)},${cella(r.dettaglio)}\n`,
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
      console.log(`  [${fatti.size}/${tutti.length}] ${b.url}`);
    }
  } finally {
    await browser?.close();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
