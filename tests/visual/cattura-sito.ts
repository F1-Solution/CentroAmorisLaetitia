import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { avviaBrowser, nuovoContesto, scatta } from './condizioni';
import { bersagli, cartellaDi } from './matrice';
import type { Viewport } from './condizioni';

/**
 * Cattura del sito nuovo (`1E-W6`), nelle stesse condizioni della `1E-W1`: stesse
 * viewport, stesse attese, stessa pagina intera, una sola cattura per confronto.
 *
 *   SITO=http://127.0.0.1:3200 npx tsx tests/visual/cattura-sito.ts
 *
 * Immagini in `docs/qa/screenshots/sito/` (fuori da Git, come il riferimento).
 * Ripartibile: salta le coppie url/viewport già presenti nel giornale.
 * Parallelismo 2, per il limite di memoria della macchina.
 */

const RADICE = process.cwd();
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';
const IMMAGINI = path.join(RADICE, 'docs/qa/screenshots/sito');
const PARALLELISMO = 2;

interface Lavoro {
  readonly url: string;
  readonly viewport: Viewport;
}

async function main(): Promise<void> {
  mkdirSync(IMMAGINI, { recursive: true });
  const giornale = path.join(IMMAGINI, 'sito.jsonl');
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
    .flatMap((b) => b.viewport.map((viewport) => ({ url: b.url, viewport })))
    .filter((l) => !fatti.has(`${l.url} ${l.viewport.nome}`))
    .filter((l) => !process.env.FILTRO || process.env.FILTRO.split(',').includes(l.url));
  console.log(`sito: ${lavori.length} catture da fare, ${fatti.size} già fatte`);

  const browser = await avviaBrowser();
  console.log(`Chromium ${browser.version()}, sito ${SITO}`);
  let prossimo = 0;
  let finiti = 0;
  const esegui = async () => {
    while (prossimo < lavori.length) {
      const lavoro = lavori[prossimo++] as Lavoro;
      try {
        const cartella = path.join(IMMAGINI, cartellaDi(lavoro.url));
        const file = path.join(cartella, `${lavoro.viewport.nome}.png`);
        const context = await nuovoContesto(browser, lavoro.viewport);
        const page = await context.newPage();
        try {
          const scatto = await scatta(page, `${SITO}${lavoro.url}`);
          mkdirSync(cartella, { recursive: true });
          writeFileSync(file, scatto.png);
          appendFileSync(
            giornale,
            `${JSON.stringify({
              url: lavoro.url,
              viewport: lavoro.viewport.nome,
              file: path.relative(RADICE, file).replaceAll('\\', '/'),
              stato_http: scatto.stato,
              errori_console: scatto.erroriConsole,
              immagini_mancanti: scatto.immaginiMancanti,
            })}\n`,
          );
        } finally {
          await context.close();
        }
      } catch (errore) {
        appendFileSync(
          path.join(IMMAGINI, 'sito.errori.log'),
          `${lavoro.url} ${lavoro.viewport.nome}: ${String(errore).split('\n')[0]}\n`,
        );
      }
      finiti += 1;
      if (finiti % 25 === 0) console.log(`${finiti}/${lavori.length}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLELISMO }, esegui));
  await browser.close();
  console.log('sito: finito');
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
