import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Browser } from '@playwright/test';
import { avviaBrowser, nuovoContesto, scatta } from './condizioni';
import { confronta, impronta } from './confronto';
import { bersagli, cartellaDi, type Bersaglio } from './matrice';
import type { Viewport } from './condizioni';

/**
 * Cattura del riferimento dall'istanza congelata (`1E-W1`).
 *
 *   tsx tests/visual/cattura-riferimento.ts riferimento   tre scatti per pagina, si tiene il primo
 *   tsx tests/visual/cattura-riferimento.ts rumore        uno scatto, confrontato col riferimento
 *
 * Le immagini vanno in `docs/qa/screenshots/` (fuori da Git, DR-106); gli esiti,
 * senza immagini, in `docs/qa/riferimento/`. Interrotto, riparte da dove era.
 */

const RADICE = process.cwd();
const BASE = process.env.WPREF_URL ?? 'http://localhost:8088';
const IMMAGINI = path.join(RADICE, 'docs/qa/screenshots/riferimento');
const ESITI = path.join(RADICE, 'docs/qa/riferimento');
const PARALLELISMO = 3;

/**
 * Le pagine che l'istanza non rende come la produzione: per DR-111 il loro
 * riferimento viene dal sito online, letto in sola lettura (DR-016). Tre hanno
 * un video di YouTube, che l'istanza non chiede perché non chiama l'esterno; una
 * cita un file che il backup ha con le maiuscole diverse.
 */
const ONLINE = 'https://www.centroamorislaetitia.it';
const DA_ONLINE = new Set([
  '/dal-vizioso-al-virtuoso/',
  '/corso-per-consulenti-familiari-vecchia-pagina/',
  '/riparte-il-corso-per-consulenti-familiari/',
  '/i-prossimi-corsi-del-centro/',
]);

function fonteDi(url: string): { base: string; nome: 'istanza' | 'online' } {
  return DA_ONLINE.has(url) ? { base: ONLINE, nome: 'online' } : { base: BASE, nome: 'istanza' };
}

/** Il sito online serve da sé i suoi file: si devia solo per l'istanza. */
function riscritturaPer(url: string): ((richiesta: string) => string | null) | undefined {
  return DA_ONLINE.has(url) ? undefined : dallaCopiaLocale;
}

/**
 * File dell'istanza chiesti con un altro indirizzo: le immagini salvate con
 * quello del sito online, e il carattere delle icone di Divi, che la sua cache
 * CSS cita con `localhost:8080`, la porta dell'istanza quando la cache nacque
 * nella 1A–1B. Oggi quella porta è di un'altra applicazione di questa macchina.
 */
const ALTRI_INDIRIZZI = new Set(['www.centroamorislaetitia.it', 'localhost:8080']);

function dallaCopiaLocale(url: string): string | null {
  const u = new URL(url);
  if (ALTRI_INDIRIZZI.has(u.host) && u.pathname.startsWith('/wp-content/')) {
    return `${BASE}${u.pathname}`;
  }
  return null;
}

interface Lavoro {
  readonly bersaglio: Bersaglio;
  readonly viewport: Viewport;
}

async function riferimento(browser: Browser, lavoro: Lavoro, giornale: string): Promise<void> {
  const { bersaglio, viewport } = lavoro;
  const cartella = path.join(IMMAGINI, cartellaDi(bersaglio.url));
  const file = path.join(cartella, `${viewport.nome}.png`);
  const context = await nuovoContesto(browser, viewport, riscritturaPer(bersaglio.url));
  const page = await context.newPage();
  try {
    const scatti = [];
    for (let n = 0; n < 3; n += 1)
      scatti.push(await scatta(page, `${fonteDi(bersaglio.url).base}${bersaglio.url}`));
    const [primo, ...altri] = scatti as [(typeof scatti)[0], ...typeof scatti];
    mkdirSync(cartella, { recursive: true });
    writeFileSync(file, primo.png);
    const stabilita = altri.map((altro) => confronta(primo.png, altro.png));
    const peggiore = stabilita.reduce((a, b) => (b.percentuale > a.percentuale ? b : a));
    if (peggiore.immagineDifferenza) {
      writeFileSync(
        path.join(cartella, `${viewport.nome}.instabile.png`),
        peggiore.immagineDifferenza,
      );
    }
    const stabile = stabilita.every((e) => e.confrontabile && e.pixelDiversi === 0);
    appendFileSync(
      giornale,
      `${JSON.stringify({
        url: bersaglio.url,
        livello: bersaglio.livello,
        origine: bersaglio.origine,
        fonte: fonteDi(bersaglio.url).nome,
        viewport: viewport.nome,
        file: path.relative(RADICE, file).replaceAll('\\', '/'),
        sha256: impronta(primo.png),
        larghezza: peggiore.larghezza,
        altezza: peggiore.altezze[0],
        stato_http: primo.stato,
        errori_console: primo.erroriConsole,
        immagini_mancanti: Math.max(...scatti.map((s) => s.immaginiMancanti)),
        esito: stabile ? 'stabile' : 'instabile',
        instabilita_pct: Number(peggiore.percentuale.toFixed(4)),
        altezze_diverse: stabilita.some((e) => !e.confrontabile),
        aree_oltre_32: peggiore.areeOltreSoglia,
      })}\n`,
    );
  } finally {
    await context.close();
  }
}

async function rumore(browser: Browser, lavoro: Lavoro, giornale: string): Promise<void> {
  const { bersaglio, viewport } = lavoro;
  const file = path.join(IMMAGINI, cartellaDi(bersaglio.url), `${viewport.nome}.png`);
  if (!existsSync(file)) return;
  const context = await nuovoContesto(browser, viewport, riscritturaPer(bersaglio.url));
  const page = await context.newPage();
  try {
    const scatto = await scatta(page, `${fonteDi(bersaglio.url).base}${bersaglio.url}`);
    const esito = confronta(readFileSync(file), scatto.png);
    appendFileSync(
      giornale,
      `${JSON.stringify({
        url: bersaglio.url,
        viewport: viewport.nome,
        confrontabile: esito.confrontabile,
        rumore_pct: Number(esito.percentuale.toFixed(4)),
        pixel_diversi: esito.pixelDiversi,
        area_massima: esito.areaMassima,
        aree_oltre_32: esito.areeOltreSoglia.length,
      })}\n`,
    );
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const modo = process.argv[2];
  if (modo !== 'riferimento' && modo !== 'rumore') {
    throw new Error('Uso: cattura-riferimento.ts riferimento|rumore');
  }
  mkdirSync(ESITI, { recursive: true });
  mkdirSync(IMMAGINI, { recursive: true });
  const giornale = path.join(IMMAGINI, `${modo}.jsonl`);
  const fatti = new Set(
    existsSync(giornale)
      ? readFileSync(giornale, 'utf-8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((riga) => {
            const r = JSON.parse(riga) as { url: string; viewport: string };
            return `${r.url} ${r.viewport}`;
          })
      : [],
  );
  const lavori: Lavoro[] = bersagli(RADICE)
    .flatMap((bersaglio) => bersaglio.viewport.map((viewport) => ({ bersaglio, viewport })))
    .filter((l) => !fatti.has(`${l.bersaglio.url} ${l.viewport.nome}`))
    // Solo alcuni indirizzi, separati da virgola: `FILTRO=/contatti/,/chi-siamo/`.
    .filter((l) => !process.env.FILTRO || process.env.FILTRO.split(',').includes(l.bersaglio.url));
  console.log(`${modo}: ${lavori.length} catture da fare, ${fatti.size} già fatte`);

  const browser = await avviaBrowser();
  console.log(`Chromium ${browser.version()}`);
  let prossimo = 0;
  let finiti = 0;
  const esegui = async () => {
    while (prossimo < lavori.length) {
      const lavoro = lavori[prossimo++] as Lavoro;
      try {
        await (modo === 'riferimento' ? riferimento : rumore)(browser, lavoro, giornale);
      } catch (errore) {
        appendFileSync(
          path.join(IMMAGINI, `${modo}.errori.log`),
          `${lavoro.bersaglio.url} ${lavoro.viewport.nome}: ${String(errore).split('\n')[0]}\n`,
        );
      }
      finiti += 1;
      if (finiti % 25 === 0) console.log(`${finiti}/${lavori.length}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLELISMO }, esegui));
  await browser.close();
  console.log(`${modo}: finito`);
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
