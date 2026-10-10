import { readFileSync } from 'node:fs';
import path from 'node:path';
import { VIEWPORT, VIEWPORT_LIVELLO_B, type Viewport } from './condizioni';

/**
 * Che cosa si cattura, da `docs/migration/url-matrix.csv` e dal §2 del piano.
 *
 * La matrice conta nei livelli A e B anche indirizzi che non hanno aspetto
 * proprio: `robots.txt` e `sitemap.xml` (confronto strutturale, §9), il 302 di
 * `wp-sitemap.xml`, e i 4 documenti che rispondono 301 (§10). Questi non si
 * fotografano come sono. Si catturano **in più**, perché il riferimento si
 * cattura una volta sola: le 4 pagine di destinazione dei documenti e le due
 * pagine successive dell'archivio delle notizie. Quali entrino nel conteggio
 * del criterio 1E-2 lo decide l'utente.
 */

export interface Bersaglio {
  readonly url: string;
  readonly livello: 'A' | 'B' | 'aggiunto';
  readonly origine: string;
  readonly viewport: readonly Viewport[];
}

const NON_VISIVI = new Set(['sistema']);

/** CSV con virgolette doppie, come lo scrive la matrice: i titoli contengono virgole. */
export function leggiCsv(file: string): Record<string, string>[] {
  const testo = readFileSync(file, 'utf-8');
  const righe: string[][] = [];
  let riga: string[] = [];
  let cella = '';
  let fraVirgolette = false;
  for (let i = 0; i < testo.length; i += 1) {
    const c = testo[i];
    if (fraVirgolette) {
      if (c === '"' && testo[i + 1] === '"') {
        cella += '"';
        i += 1;
      } else if (c === '"') fraVirgolette = false;
      else cella += c;
    } else if (c === '"') fraVirgolette = true;
    else if (c === ',') {
      riga.push(cella);
      cella = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && testo[i + 1] === '\n') i += 1;
      riga.push(cella);
      righe.push(riga);
      riga = [];
      cella = '';
    } else cella += c;
  }
  if (cella !== '' || riga.length > 0) righe.push([...riga, cella]);
  const [colonne = [], ...dati] = righe.filter((r) => r.some((c) => c !== ''));
  return dati.map((r) => Object.fromEntries(colonne.map((c, i) => [c, r[i] ?? ''])));
}

export function bersagli(radice: string): Bersaglio[] {
  const righe = leggiCsv(path.join(radice, 'docs/migration/url-matrix.csv'));
  const livelloB = VIEWPORT.filter((v) => VIEWPORT_LIVELLO_B.includes(v.nome));
  const out: Bersaglio[] = [];
  for (const riga of righe) {
    const priorita = riga.priorita_parita;
    if (priorita !== 'alta' && priorita !== 'media') continue;
    if (NON_VISIVI.has(riga.tipo ?? '')) continue;
    const viewport = priorita === 'alta' ? VIEWPORT : livelloB;
    const livello = priorita === 'alta' ? 'A' : 'B';
    if (riga.stato_misurato === '301' && riga.destinazione_redirect) {
      out.push({
        url: riga.destinazione_redirect,
        livello: 'aggiunto',
        origine: `destinazione di ${riga.url ?? ''}`,
        viewport,
      });
      continue;
    }
    out.push({ url: riga.url ?? '', livello, origine: 'matrice', viewport });
  }
  for (const pagina of [2, 3]) {
    out.push({
      url: `/category/news/page/${pagina}/`,
      livello: 'aggiunto',
      origine: 'paginazione di /category/news/',
      viewport: livelloB,
    });
  }
  return out;
}

/** Nome di cartella stabile per un indirizzo. */
export function cartellaDi(url: string): string {
  const pulito = url.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9-]+/gi, '__');
  return pulito === '' ? 'home' : pulito;
}
