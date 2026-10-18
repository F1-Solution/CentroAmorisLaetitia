import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Browser } from '@playwright/test';
import { avviaBrowser, VIEWPORT } from './condizioni';
import { leggiCsv } from './matrice';

/**
 * T5 della `1E-W7` (criterio 1E-17): sugli 81 URL ad alta priorità, alle 6
 * viewport, nessun errore in console, nessuna eccezione, nessuna richiesta
 * fallita o con risposta ≥ 400, nessuna richiesta a un host diverso dal sito.
 *
 *   SITO=http://127.0.0.1:3200 pnpm exec tsx tests/visual/verifica-console.ts
 *
 * Solo il sito nuovo, senza nessuna richiesta bloccata: si vuole vedere tutto
 * ciò che la pagina chiede. Il 404 atteso di `/404-url-inesistente/` non conta
 * come risposta fallita. Ripresa da `stato-console.json` (HO-014).
 */

const RADICE = process.cwd();
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';
const CARTELLA = path.join(RADICE, 'docs/qa/screenshots/verifiche');
const STATO = path.join(CARTELLA, 'stato-console.json');
const CSV = path.join(RADICE, 'docs/qa/verifiche/console.csv');
const URL_PER_BROWSER = 10;
/** `LIMITE=n`: si ferma dopo n misure (ripartibile). */
const LIMITE = Number(process.env.LIMITE ?? Infinity);

interface Esito {
  readonly console: string[];
  readonly eccezioni: string[];
  readonly fallite: string[];
  readonly risposte400: string[];
  readonly terzi: string[];
}

async function misura(
  browser: Browser,
  url: string,
  width: number,
  height: number,
): Promise<Esito> {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    serviceWorkers: 'block',
  });
  const host = new URL(SITO).host;
  const indirizzo = `${SITO}${url}`;
  const e = {
    console: [] as string[],
    eccezioni: [] as string[],
    fallite: [] as string[],
    risposte400: [] as string[],
    terzi: [] as string[],
  };
  try {
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') e.console.push(m.text().slice(0, 160));
    });
    page.on('pageerror', (err) => e.eccezioni.push(err.message.slice(0, 160)));
    page.on('requestfailed', (r) =>
      e.fallite.push(`${r.url()} (${r.failure()?.errorText ?? '?'})`),
    );
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (!['data:', 'blob:'].includes(u.protocol) && u.host !== host) e.terzi.push(r.url());
    });
    page.on('response', (r) => {
      // La pagina d'errore risponde 404 di proposito; la sua risposta principale non è un difetto.
      if (r.status() >= 400 && !(r.url() === indirizzo && url.startsWith('/404-')))
        e.risposte400.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(indirizzo, { waitUntil: 'networkidle', timeout: 90_000 });
    // Le immagini differite e i blocchi caricati a vista partono solo scorrendo.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise((f) => setTimeout(f, 100));
      }
    });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    // Il 404 atteso del browser per la pagina d'errore compare anche come errore di console.
    if (url.startsWith('/404-')) e.console = e.console.filter((t) => !/status of 404/.test(t));
  } finally {
    await ctx.close();
  }
  return e;
}

const cella = (v: string) => `"${v.replaceAll('"', '""')}"`;

async function main(): Promise<void> {
  mkdirSync(CARTELLA, { recursive: true });
  const fatti = new Set<string>(
    existsSync(STATO)
      ? (JSON.parse(readFileSync(STATO, 'utf-8')) as { fatti: string[] }).fatti
      : [],
  );
  if (!existsSync(CSV))
    writeFileSync(
      CSV,
      'url,viewport,console,eccezioni,richieste_fallite,risposte_400,richieste_terzi,dettaglio\n',
    );
  const tutti = leggiCsv(path.join(RADICE, 'docs/migration/url-matrix.csv'))
    .filter((r) => r.priorita_parita === 'alta')
    .map((r) => r.url ?? '');
  const lavori = tutti
    .flatMap((url) => VIEWPORT.map((v) => ({ url, v, chiave: `${url}@${v.nome}` })))
    .filter((l) => !fatti.has(l.chiave));
  console.log(
    `console: ${tutti.length * VIEWPORT.length} misure, ${fatti.size} già fatte, ${lavori.length} da fare`,
  );
  let browser: Browser | null = null;
  let n = 0;
  try {
    for (const l of lavori) {
      if (n >= LIMITE) break;
      if (!browser || n % (URL_PER_BROWSER * VIEWPORT.length) === 0) {
        await browser?.close();
        browser = await avviaBrowser();
      }
      n += 1;
      try {
        const e = await misura(browser, l.url, l.v.width, l.v.height);
        const dettaglio = [
          ...e.console.map((t) => `console: ${t}`),
          ...e.eccezioni.map((t) => `eccezione: ${t}`),
          ...e.fallite.map((t) => `fallita: ${t}`),
          ...e.risposte400,
          ...[...new Set(e.terzi)].map((t) => `terzi: ${t}`),
        ]
          .slice(0, 8)
          .join(' | ');
        appendFileSync(
          CSV,
          [
            l.url,
            l.v.nome,
            e.console.length,
            e.eccezioni.length,
            e.fallite.length,
            e.risposte400.length,
            e.terzi.length,
            dettaglio,
          ]
            .map((x) => cella(String(x)))
            .join(',') + '\n',
        );
      } catch (errore) {
        console.log(
          `  ${l.chiave}: errore ${(errore as Error).message.split('\n')[0]}; si riprova al prossimo avvio`,
        );
        await browser.close().catch(() => undefined);
        browser = null;
        continue;
      }
      fatti.add(l.chiave);
      writeFileSync(STATO, JSON.stringify({ fatti: [...fatti] }, null, 1));
      if (n % 30 === 0) console.log(`  ${fatti.size}/${tutti.length * VIEWPORT.length}`);
    }
  } finally {
    await browser?.close();
  }
  console.log(`console: ${fatti.size}/${tutti.length * VIEWPORT.length} misure`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
