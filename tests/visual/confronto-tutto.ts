import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { confronta, impronta, LATO_AREA_MASSIMA } from './confronto';
import { bersagli, cartellaDi } from './matrice';

/**
 * Confronto dei 585 (DR-112): riferimento (`1E-W1`) contro sito nuovo (`1E-W6`),
 * con le maschere ammesse del §5.1 e di DR-120, lette da
 * `docs/qa/confronto/maschere.json` (prodotto da `maschere.ts`).
 *
 *   npx tsx tests/visual/confronto-tutto.ts
 *
 * Immagini di differenza fuori da Git in `docs/qa/screenshots/diff/`; esiti
 * senza immagini, con le impronte sha256, in `docs/qa/confronto/esiti.csv`.
 */

const RADICE = process.cwd();
const RIFERIMENTO = path.join(RADICE, 'docs/qa/screenshots/riferimento');
const SITO = path.join(RADICE, 'docs/qa/screenshots/sito');
const DIFF = path.join(RADICE, 'docs/qa/screenshots/diff');
const ESITI = path.join(RADICE, 'docs/qa/confronto');

const SOGLIA_AUTOMATICA = 0; // DR-113
const SOGLIA_ESAME = 0.5; // visual-regression-plan.md §6.2

interface MascheraGrezza {
  readonly url: string;
  readonly viewport: string;
  readonly motivo: string;
  readonly selettore: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function leggiMaschere(): MascheraGrezza[] {
  const file = path.join(ESITI, 'maschere.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf-8')) as MascheraGrezza[];
}

/** Annerisce un rettangolo identico nelle due immagini, prima del confronto. */
function applicaMaschere(png: Buffer, rettangoli: readonly MascheraGrezza[]): Buffer {
  if (rettangoli.length === 0) return png;
  const img = PNG.sync.read(png);
  for (const r of rettangoli) {
    const x0 = Math.max(0, r.x);
    const y0 = Math.max(0, r.y);
    const x1 = Math.min(img.width, r.x + r.w);
    const y1 = Math.min(img.height, r.y + r.h);
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * img.width + x) * 4;
        img.data[i] = 0;
        img.data[i + 1] = 0;
        img.data[i + 2] = 0;
        img.data[i + 3] = 255;
      }
    }
  }
  return PNG.sync.write(img);
}

function esitoDi(percentuale: number, areeOltre: number): string {
  if (areeOltre > 0) return 'fallito';
  if (percentuale <= SOGLIA_AUTOMATICA) return 'superato';
  if (percentuale <= SOGLIA_ESAME) return 'da_esaminare';
  return 'fallito';
}

async function main(): Promise<void> {
  mkdirSync(DIFF, { recursive: true });
  mkdirSync(ESITI, { recursive: true });
  const csv = path.join(ESITI, 'esiti.csv');
  writeFileSync(
    csv,
    'url,livello,viewport,confrontabile,percentuale,area_massima,aree_oltre_32,esito,maschere,sha256_riferimento,sha256_sito,nota\n',
  );

  const tutteLeMaschere = leggiMaschere();
  const pagine = bersagli(RADICE);
  let fatti = 0;
  let superati = 0;
  let esaminare = 0;
  let falliti = 0;
  let oltreSoglia = 0;
  let senzaImmagine = 0;

  for (const b of pagine) {
    for (const viewport of b.viewport) {
      const cartella = cartellaDi(b.url);
      const fileRif = path.join(RIFERIMENTO, cartella, `${viewport.nome}.png`);
      const fileSito = path.join(SITO, cartella, `${viewport.nome}.png`);
      if (!existsSync(fileRif) || !existsSync(fileSito)) {
        senzaImmagine += 1;
        appendFileSync(
          csv,
          `"${b.url}",${b.livello},${viewport.nome},,,,,"senza_immagine",,,,"${!existsSync(fileRif) ? 'manca riferimento' : 'manca sito'}"\n`,
        );
        continue;
      }
      const rifBuf = readFileSync(fileRif);
      const sitoBufOriginale = readFileSync(fileSito);
      const shaRif = impronta(rifBuf);
      const shaSito = impronta(sitoBufOriginale);
      const maschere = tutteLeMaschere.filter(
        (m) => m.url === b.url && m.viewport === viewport.nome,
      );
      const a = applicaMaschere(rifBuf, maschere);
      const bb = applicaMaschere(sitoBufOriginale, maschere);
      const esito = confronta(a, bb);
      fatti += 1;
      if (!esito.confrontabile) {
        falliti += 1;
        appendFileSync(
          csv,
          `"${b.url}",${b.livello},${viewport.nome},no,100,,0,"fallito",${maschere.length},${shaRif},${shaSito},"altezze diverse: ${esito.altezze[0]} vs ${esito.altezze[1]}"\n`,
        );
        continue;
      }
      const stato = esitoDi(esito.percentuale, esito.areeOltreSoglia.length);
      if (stato === 'superato') superati += 1;
      else if (stato === 'da_esaminare') esaminare += 1;
      else falliti += 1;
      if (esito.areeOltreSoglia.length > 0) oltreSoglia += 1;
      if (esito.immagineDifferenza) {
        const cartellaDiff = path.join(DIFF, cartella);
        mkdirSync(cartellaDiff, { recursive: true });
        writeFileSync(path.join(cartellaDiff, `${viewport.nome}.png`), esito.immagineDifferenza);
      }
      const areaMassima = esito.areaMassima
        ? `${esito.areaMassima.w}x${esito.areaMassima.h}@${esito.areaMassima.x},${esito.areaMassima.y}`
        : '';
      appendFileSync(
        csv,
        `"${b.url}",${b.livello},${viewport.nome},si,${esito.percentuale.toFixed(4)},"${areaMassima}",${esito.areeOltreSoglia.length},"${stato}",${maschere.length},${shaRif},${shaSito},\n`,
      );
      if (fatti % 50 === 0) console.log(`${fatti} confronti fatti`);
    }
  }
  console.log(
    `totale ${fatti}; superati ${superati}; da esaminare ${esaminare}; falliti ${falliti}; aree oltre 32x32 ${oltreSoglia}; senza immagine ${senzaImmagine}`,
  );
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
