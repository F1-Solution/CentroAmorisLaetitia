import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { avviaBrowser, nuovoContesto, VIEWPORT } from './condizioni';
import { SPACING_VARIABLES } from '@amoris/blocks';
import { bersagli, leggiCsv } from './matrice';

/**
 * Verifiche della `1E-W4` sul sito nuovo avviato:
 *
 * - menu reso a un anonimo contro `public-menu.csv` (criterio 1E-7);
 * - nessuno scorrimento orizzontale alle 6 viewport, su ogni pagina della matrice;
 * - lingua della pagina dichiarata come italiano (A-6);
 * - nessun service worker registrato (1E-12).
 *
 *   SITO=http://127.0.0.1:3200 tsx tests/visual/verifica-sito.ts
 */

const RADICE = process.cwd();
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';

async function main(): Promise<void> {
  const browser = await avviaBrowser();

  // Menu.
  const context = await nuovoContesto(browser, VIEWPORT[0]!);
  const page = await context.newPage();
  await page.goto(`${SITO}/chi-siamo/`, { waitUntil: 'networkidle' });
  const voci = await page.evaluate(() => {
    const out: { livello: number; etichetta: string; href: string }[] = [];
    const visita = (ul: Element, livello: number) => {
      for (const li of ul.querySelectorAll(':scope > li')) {
        const a = li.querySelector(':scope > a');
        out.push({
          livello,
          etichetta: a?.textContent?.trim() ?? '',
          href: a?.getAttribute('href') ?? '',
        });
        const figlio = li.querySelector(':scope > ul');
        if (figlio) visita(figlio, livello + 1);
      }
    };
    const radice = document.querySelector('#top-menu');
    if (radice) visita(radice, 1);
    return out;
  });
  const attese = leggiCsv(path.join(RADICE, 'docs/migration/public-menu.csv'));
  const menuDiversi = attese.filter((a, i) => {
    const v = voci[i];
    const atteso = (a.etichetta ?? '')
      .replace(/&#8217;/g, '’')
      .replace(/&amp;/g, '&')
      .trim();
    return !v || String(v.livello) !== a.livello || v.etichetta !== atteso || v.href !== a.href;
  });
  const lingua = await page.evaluate(() => document.documentElement.lang);
  const serviceWorker = await page.evaluate(async () =>
    'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
  );
  await context.close();
  console.log(
    `menu: ${voci.length} voci rese, ${attese.length} attese, ${menuDiversi.length} diverse`,
  );
  for (const d of menuDiversi.slice(0, 5)) console.log('  ', JSON.stringify(d));
  console.log(`lingua: ${lingua}; service worker registrati: ${serviceWorker}`);

  // Titolo principale (1E-14) e stile in linea (1E-15), sulle pagine della matrice a 1440.
  const ammesse = new Set(SPACING_VARIABLES);
  const titoli: string[] = [];
  const stiliNonAmmessi: string[] = [];
  const stiliCopiati: string[] = [];
  const stiliDelQuadro: string[] = [];
  {
    const ctx = await nuovoContesto(browser, VIEWPORT[0]!);
    const p = await ctx.newPage();
    for (const b of bersagli(RADICE)) {
      const risposta = await p.goto(`${SITO}${b.url}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      const esito = await p.evaluate(() => ({
        h1: document.querySelectorAll('h1').length,
        // DR-118: le dichiarazioni dentro un blocco di riserva o nel piè di pagina
        // sono markup copiato dalla sorgente; si contano a parte.
        stili: [...document.querySelectorAll('[style]')].flatMap((el) => {
          const st = (el as HTMLElement).style;
          const copiato = el.closest('.blk-raw, .footer-widget') !== null;
          // L'annunciatore di rotta che Next.js aggiunge a runtime: del quadro, non della pagina.
          const quadro = el.tagName === 'NEXT-ROUTE-ANNOUNCER';
          return Array.from({ length: st.length }, (_, i) => ({
            nome: st.item(i),
            copiato,
            quadro,
          }));
        }),
      }));
      if (risposta?.status() === 200 && esito.h1 !== 1) titoli.push(`${b.url} (${esito.h1} h1)`);
      for (const { nome, copiato, quadro } of esito.stili) {
        if (ammesse.has(nome)) continue;
        (quadro ? stiliDelQuadro : copiato ? stiliCopiati : stiliNonAmmessi).push(
          `${b.url} ${nome}`,
        );
      }
    }
    await ctx.close();
  }
  console.log(`pagine senza esattamente un h1: ${titoli.length}`);
  for (const t of titoli.slice(0, 10)) console.log('  ', t);
  console.log(`dichiarazioni in linea generate fuori elenco (1E-15): ${stiliNonAmmessi.length}`);
  console.log(
    `dichiarazioni copiate dalla sorgente (blocchi di riserva, piè di pagina; DR-118): ${new Set(stiliCopiati).size}`,
  );
  console.log(`dichiarazioni dell'annunciatore di rotta di Next.js: ${stiliDelQuadro.length}`);
  for (const t of [...new Set(stiliNonAmmessi)].slice(0, 10)) console.log('  ', t);

  // Scorrimento orizzontale.
  const pagine = bersagli(RADICE);
  const orizzontali: string[] = [];
  for (const viewport of VIEWPORT) {
    const ctx = await nuovoContesto(browser, viewport);
    const p = await ctx.newPage();
    for (const b of pagine.filter((x) => x.viewport.some((v) => v.nome === viewport.nome))) {
      await p.goto(`${SITO}${b.url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const eccede = await p.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (eccede > 0) orizzontali.push(`${b.url} ${viewport.nome} (+${eccede}px)`);
    }
    await ctx.close();
  }
  console.log(`scorrimento orizzontale: ${orizzontali.length} casi`);
  for (const o of orizzontali.slice(0, 20)) console.log('  ', o);
  writeFileSync(
    path.join(RADICE, 'docs/qa/riferimento/verifica-sito-w4.json'),
    `${JSON.stringify({ menu: { rese: voci.length, attese: attese.length, diverse: menuDiversi }, lingua, serviceWorker, titoli, stiliNonAmmessi, stiliCopiati: [...new Set(stiliCopiati)], stiliDelQuadro, orizzontali }, null, 1)}\n`,
  );
  await browser.close();
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
