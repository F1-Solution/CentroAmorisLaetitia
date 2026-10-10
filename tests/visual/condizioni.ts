import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Le condizioni di cattura di `docs/qa/visual-regression-plan.md` §3–§5, in un
 * punto solo: riferimento e sito nuovo si catturano con **questa** funzione, o il
 * confronto misura l'ambiente invece della resa.
 */

export interface Viewport {
  readonly nome: string;
  readonly width: number;
  readonly height: number;
}

/** §3: ricavate dai punti di rottura del tema, fattore di scala 1 su tutte. */
export const VIEWPORT: readonly Viewport[] = [
  { nome: '1440', width: 1440, height: 900 },
  { nome: '1280', width: 1280, height: 800 },
  { nome: '1024', width: 1024, height: 768 },
  { nome: '768', width: 768, height: 1024 },
  { nome: '390', width: 390, height: 844 },
  { nome: '360', width: 360, height: 800 },
];

/** §2: il livello B si cattura solo a queste tre. */
export const VIEWPORT_LIVELLO_B = ['1440', '768', '390'];

/** §5 condizione 4: il ritardo fisso dopo la quiete della rete, dichiarato. */
export const RITARDO_FISSO_MS = 1500;

/**
 * Richieste che non cambiano la resa e non devono partire da una cattura: le
 * analisi del traffico. Bloccarle evita di registrare visite finte.
 */
const NON_DI_RESA = /googletagmanager\.com|google-analytics\.com|doubleclick\.net/;

/** §5 condizione 8: profilo colore e rasterizzazione dei caratteri riproducibili. */
export async function avviaBrowser(): Promise<Browser> {
  return chromium.launch({
    args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text'],
  });
}

/**
 * §5 condizioni 1 e 2: fuso, lingua, sessione anonima. `riscrivi` permette al
 * chiamante di servire in locale un file che la pagina chiede altrove.
 */
export async function nuovoContesto(
  browser: Browser,
  viewport: Viewport,
  riscrivi?: (url: string) => string | null,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  // `tsx` aggiunge `__name(...)` alle funzioni con nome passate a `evaluate`.
  await context.addInitScript('window.__name = (f) => f');
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    try {
      if (NON_DI_RESA.test(url)) return await route.abort();
      const altrove = riscrivi?.(url);
      // Da https a http `continue` non si può: si legge la copia e la si serve.
      if (altrove) {
        // Sul sito vero pagina e file hanno la stessa origine; qui no, e un
        // carattere servito da un'altra origine il browser lo rifiuta senza questa intestazione.
        const risposta = await context.request.get(altrove);
        return await route.fulfill({
          response: risposta,
          headers: { ...risposta.headers(), 'access-control-allow-origin': '*' },
        });
      }
      return await route.continue();
    } catch {
      // Pagina chiusa o richiesta già conclusa: nulla da servire.
    }
  });
  return context;
}

/**
 * Una cattura a pagina intera non scorre: le immagini con `loading="lazy"` e le
 * animazioni d'ingresso di Divi, che partono quando l'elemento entra in vista,
 * resterebbero non caricate o invisibili. Si scorre la pagina fino in fondo a
 * passi di una schermata, si attende ogni immagine, e si torna in cima.
 */
async function caricaTutto(page: Page): Promise<number> {
  // `loading` non si tocca: `sizes="auto"` vale solo con `lazy`, e cambiarlo
  // sceglierebbe un'altra dimensione dell'immagine. Basta lo scorrimento.
  const mancanti = await page.evaluate(async () => {
    const passo = window.innerHeight;
    for (let y = 0; y < document.documentElement.scrollHeight; y += passo) {
      window.scrollTo(0, y);
      await new Promise((fatto) => setTimeout(fatto, 120));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    // Caricata **e** decodificata: un'immagine grande può risultare caricata e
    // non ancora dipinta. Fino a 60 secondi, poi si conta come mancante.
    const attesa = (img: HTMLImageElement) =>
      new Promise<void>((fatto) => {
        const fine = setTimeout(fatto, 60_000);
        const pronta = () => {
          clearTimeout(fine);
          img.decode().then(fatto, fatto);
        };
        if (img.complete && img.naturalWidth > 0) pronta();
        else {
          img.addEventListener('load', pronta, { once: true });
          img.addEventListener('error', () => fatto(), { once: true });
        }
      });
    const visibili = Array.from(document.images).filter((img) => img.currentSrc || img.src);
    await Promise.all(visibili.map(attesa));
    window.scrollTo(0, 0);
    return visibili.filter((img) => !img.complete || img.naturalWidth === 0).length;
  });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  return mancanti;
}

export interface Scatto {
  readonly png: Buffer;
  readonly stato: number;
  readonly erroriConsole: number;
  /** Immagini con un indirizzo ma non caricate: una cattura con mancanti non è un riferimento. */
  readonly immaginiMancanti: number;
}

/** §5 condizioni 3–7 e 9: una pagina caricata, ferma, a pagina intera. */
export async function scatta(page: Page, url: string): Promise<Scatto> {
  let erroriConsole = 0;
  // Le richieste di analisi bloccate di proposito producono «net::ERR_FAILED»: non si contano.
  const conta = (msg: { type(): string; text(): string }) => {
    if (msg.type() === 'error' && !msg.text().includes('net::ERR_FAILED')) erroriConsole += 1;
  };
  page.on('console', conta);
  try {
    const risposta = await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const immaginiMancanti = await caricaTutto(page);
    await page.waitForTimeout(RITARDO_FISSO_MS);
    await page.addStyleTag({
      content:
        '*{caret-color:transparent!important}html{scrollbar-width:none}::-webkit-scrollbar{display:none}',
    });
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    const png = await page.screenshot({
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    });
    return { png, stato: risposta?.status() ?? 0, erroriConsole, immaginiMancanti };
  } finally {
    page.off('console', conta);
  }
}
