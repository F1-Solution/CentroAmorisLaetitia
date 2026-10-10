import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Dai giornali della cattura (fuori da Git, con le immagini) alle tabelle che
 * entrano in Git: una riga per cattura con la sua impronta (DR-106), e il
 * rumore di fondo misurato (`visual-regression-plan.md` §6.3, criterio 1E-1).
 */

const RADICE = process.cwd();
const IMMAGINI = path.join(RADICE, 'docs/qa/screenshots/riferimento');
const ESITI = path.join(RADICE, 'docs/qa/riferimento');

interface Cattura {
  url: string;
  livello: string;
  origine: string;
  fonte?: string;
  viewport: string;
  file: string;
  sha256: string;
  larghezza: number;
  altezza: number;
  stato_http: number;
  errori_console: number;
  immagini_mancanti: number;
  esito: string;
  instabilita_pct: number;
  altezze_diverse: boolean;
  aree_oltre_32: { x: number; y: number; w: number; h: number }[];
}

interface Rumore {
  url: string;
  viewport: string;
  confrontabile: boolean;
  rumore_pct: number;
  aree_oltre_32: number;
}

function giornale<T>(nome: string): T[] {
  const file = path.join(IMMAGINI, nome);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((riga) => JSON.parse(riga) as T);
}

const ordine = (a: { url: string; viewport: string }, b: { url: string; viewport: string }) =>
  a.url.localeCompare(b.url) || Number(b.viewport) - Number(a.viewport);

const catture = giornale<Cattura>('riferimento.jsonl').sort(ordine);
writeFileSync(
  path.join(ESITI, 'catture.csv'),
  `${[
    'url,livello,fonte,viewport,sha256,larghezza,altezza,stato_http,errori_console,immagini_mancanti,esito,instabilita_pct,aree_instabili_oltre_32',
    ...catture.map((c) =>
      [
        c.url,
        c.livello,
        c.fonte ?? 'istanza',
        c.viewport,
        c.sha256,
        c.larghezza,
        c.altezza,
        c.stato_http,
        c.errori_console,
        c.immagini_mancanti,
        c.esito,
        c.instabilita_pct,
        c.aree_oltre_32.map((a) => `${a.x}:${a.y}:${a.w}x${a.h}`).join(' '),
      ].join(','),
    ),
  ].join('\n')}\n`,
);

const rumori = giornale<Rumore>('rumore.jsonl').sort(ordine);
writeFileSync(
  path.join(ESITI, 'rumore.csv'),
  `${[
    'url,viewport,confrontabile,rumore_pct,aree_oltre_32',
    ...rumori.map((r) =>
      [r.url, r.viewport, r.confrontabile, r.rumore_pct, r.aree_oltre_32].join(','),
    ),
  ].join('\n')}\n`,
);

const valori = rumori
  .filter((r) => r.confrontabile)
  .map((r) => r.rumore_pct)
  .sort((a, b) => a - b);
const quantile = (q: number) =>
  valori[Math.min(valori.length - 1, Math.floor(q * valori.length))] ?? 0;
const instabili = catture.filter((c) => c.esito === 'instabile');
console.log(
  JSON.stringify(
    {
      catture: catture.length,
      stabili: catture.length - instabili.length,
      con_immagini_mancanti: catture
        .filter((c) => c.immagini_mancanti > 0)
        .map((c) => `${c.url} ${c.viewport}`),
      instabili: instabili.length,
      url_instabili: [...new Set(instabili.map((c) => c.url))],
      stati_http: [...new Set(catture.map((c) => c.stato_http))],
      rumore: {
        confronti: rumori.length,
        non_confrontabili: rumori.filter((r) => !r.confrontabile).length,
        zero: valori.filter((v) => v === 0).length,
        mediana: quantile(0.5),
        p95: quantile(0.95),
        massimo: valori.at(-1) ?? 0,
        con_aree_oltre_32: rumori.filter((r) => r.aree_oltre_32 > 0).length,
      },
    },
    null,
    1,
  ),
);
