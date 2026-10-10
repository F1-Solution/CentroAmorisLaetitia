import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { avviaBrowser, nuovoContesto, scatta, VIEWPORT } from './condizioni';
import { confronta, impronta } from './confronto';
import { cartellaDi, leggiCsv } from './matrice';

/**
 * Controprova sul sito online (`visual-regression-plan.md` §1, criterio 1E-10):
 * 10 URL ad alta priorità, letti **in sola lettura** come consente DR-016, e
 * confrontati con le catture dell'istanza di riferimento.
 *
 * Scelta dei 10, deterministica: la home, `/contatti/`, e 8 pagine ad alta
 * priorità prese a passo costante nell'ordine alfabetico della matrice.
 * Viewport 1440 e 390: una per famiglia di punti di rottura.
 */

const RADICE = process.cwd();
const ONLINE = 'https://www.centroamorislaetitia.it';
const RIFERIMENTO = path.join(RADICE, 'docs/qa/screenshots/riferimento');
const IMMAGINI = path.join(RADICE, 'docs/qa/screenshots/controprova');
const ESITI = path.join(RADICE, 'docs/qa/riferimento');

function scelti(): string[] {
  const pagine = leggiCsv(path.join(RADICE, 'docs/migration/url-matrix.csv'))
    .filter((r) => r.priorita_parita === 'alta' && r.tipo === 'page')
    .map((r) => r.url ?? '')
    .filter((u) => u !== '/' && u !== '/contatti/')
    .sort();
  const passo = Math.floor(pagine.length / 8);
  return ['/', '/contatti/', ...Array.from({ length: 8 }, (_, i) => pagine[i * passo] ?? '')];
}

async function main(): Promise<void> {
  mkdirSync(IMMAGINI, { recursive: true });
  const browser = await avviaBrowser();
  const righe = [
    'url,viewport,altezza_riferimento,altezza_online,percentuale,area_massima,aree_oltre_32,sha256_online',
  ];
  for (const url of scelti()) {
    for (const viewport of VIEWPORT.filter((v) => v.nome === '1440' || v.nome === '390')) {
      const context = await nuovoContesto(browser, viewport);
      const page = await context.newPage();
      const scatto = await scatta(page, `${ONLINE}${url}`);
      await context.close();
      const cartella = path.join(IMMAGINI, cartellaDi(url));
      mkdirSync(cartella, { recursive: true });
      writeFileSync(path.join(cartella, `${viewport.nome}.png`), scatto.png);
      const riferimento = readFileSync(
        path.join(RIFERIMENTO, cartellaDi(url), `${viewport.nome}.png`),
      );
      const esito = confronta(riferimento, scatto.png);
      if (esito.immagineDifferenza) {
        writeFileSync(
          path.join(cartella, `${viewport.nome}.differenza.png`),
          esito.immagineDifferenza,
        );
      }
      const area = esito.areaMassima ? `${esito.areaMassima.w}x${esito.areaMassima.h}` : '';
      righe.push(
        [
          url,
          viewport.nome,
          esito.altezze[0],
          esito.altezze[1],
          esito.confrontabile ? esito.percentuale.toFixed(4) : 'non confrontabile',
          area,
          esito.areeOltreSoglia.length,
          impronta(scatto.png),
        ].join(','),
      );
      console.log(righe.at(-1));
    }
  }
  writeFileSync(path.join(ESITI, 'controprova.csv'), `${righe.join('\n')}\n`);
  await browser.close();
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
