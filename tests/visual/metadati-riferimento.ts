import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { avviaBrowser } from './condizioni';
import { leggiCsv } from './matrice';
import { CAMPI, coincide, csv, leggiMetadati, NOMI, relativo } from './metadati';

/**
 * Metadati e menu dell'istanza di riferimento (`visual-regression-plan.md` §9),
 * rimisurati nella `1E-W1` contro `seo-rendered-baseline.csv` e
 * `public-menu.csv`, che la `1B-W0` aveva misurato **sulla stessa istanza**: se
 * coincidono, l'istanza è ancora quella congelata.
 *
 * Si legge l'HTML servito, senza JavaScript, come nella 1B: description e `h1`
 * sono decisi dal server.
 */

const RADICE = process.cwd();
const BASE = process.env.WPREF_URL ?? 'http://localhost:8088';
const ESITI = path.join(RADICE, 'docs/qa/riferimento');

async function main(): Promise<void> {
  mkdirSync(ESITI, { recursive: true });
  const attesi = leggiCsv(path.join(RADICE, 'docs/migration/seo-rendered-baseline.csv'));
  const browser = await avviaBrowser();
  const context = await browser.newContext({ javaScriptEnabled: false, locale: 'it-IT' });
  const page = await context.newPage();

  const righe: string[][] = [['url', 'esito', 'campi_diversi', 'byte_1b', 'byte_oggi']];
  let uguali = 0;
  for (const atteso of attesi) {
    const url = atteso.url ?? '';
    const { valori: oggi, byte: corpo } = await leggiMetadati(page, `${BASE}${url}`);
    const diversi = CAMPI.filter(
      (campo) =>
        !coincide(
          campo === 'canonical' || campo === 'og_image'
            ? relativo(atteso[campo] ?? '')
            : (atteso[campo] ?? ''),
          oggi[campo] ?? '',
        ),
    );
    if (diversi.length === 0) uguali += 1;
    righe.push([
      url,
      diversi.length === 0 ? 'uguale' : 'diverso',
      diversi.join(' '),
      atteso.byte ?? '',
      String(corpo),
    ]);
  }
  writeFileSync(path.join(ESITI, 'metadati.csv'), csv(righe));
  console.log(`metadati: ${uguali} uguali su ${attesi.length}`);

  // Menu reso a un anonimo, contro `public-menu.csv`: ordine, livello, etichetta, indirizzo.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(NOMI);
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
  const menuAtteso = leggiCsv(path.join(RADICE, 'docs/migration/public-menu.csv'));
  const menu: string[][] = [['posizione', 'esito', 'livello', 'etichetta', 'href']];
  let menuUguali = 0;
  const n = Math.max(voci.length, menuAtteso.length);
  for (let i = 0; i < n; i += 1) {
    const v = voci[i];
    const a = menuAtteso[i];
    const uguale =
      v !== undefined &&
      a !== undefined &&
      String(v.livello) === a.livello &&
      coincide(a.etichetta ?? '', v.etichetta) &&
      relativo(v.href) === relativo(a.href ?? '');
    if (uguale) menuUguali += 1;
    menu.push([
      String(i + 1),
      uguale ? 'uguale' : 'diverso',
      v ? String(v.livello) : '',
      v?.etichetta ?? '',
      v ? relativo(v.href) : '',
    ]);
  }
  writeFileSync(path.join(ESITI, 'menu.csv'), csv(menu));
  console.log(`menu: ${voci.length} voci rese, ${menuAtteso.length} attese, ${menuUguali} uguali`);
  await browser.close();
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
