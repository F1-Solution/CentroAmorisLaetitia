import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { avviaBrowser } from './condizioni';
import { leggiCsv } from './matrice';

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
const CAMPI = [
  'http',
  'title',
  'description',
  'canonical',
  'og_title',
  'og_description',
  'og_image',
  'og_type',
  'robots',
  'h1',
  'schema_types',
] as const;

/** Il file della 1B conserva le entità HTML come le serviva la pagina. */
function decodifica(testo: string): string {
  const nominate: Record<string, string> = {
    quot: '"',
    amp: '&',
    lt: '<',
    gt: '>',
    apos: "'",
    nbsp: ' ',
  };
  return testo.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (intera, nome: string) => {
    if (nome[0] === '#') {
      const codice =
        nome[1]?.toLowerCase() === 'x' ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
      return String.fromCodePoint(codice);
    }
    return nominate[nome.toLowerCase()] ?? intera;
  });
}

/** Il file della 1B ha alcune lettere accentate perse in `�`: valgono come jolly. */
function coincide(atteso: string, misurato: string): boolean {
  const a = decodifica(atteso).replace(/\s+/g, ' ').trim();
  const m = misurato.replace(/\s+/g, ' ').trim();
  if (!a.includes('�')) return a === m;
  const modello = a
    .split('�')
    .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.{1,2}');
  return new RegExp(`^${modello}$`, 'u').test(m);
}

/** Gli indirizzi assoluti dipendono dalla porta dell'istanza: si confronta il percorso. */
function relativo(valore: string): string {
  return valore.replace(/^https?:\/\/[^/]+/, '');
}

/** `tsx` aggiunge `__name(...)` alle funzioni con nome: nel browser va definito. */
const NOMI = 'window.__name = (f) => f';

function csv(righe: readonly (readonly string[])[]): string {
  return `${righe
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replaceAll('"', '""')}"` : c)).join(','))
    .join('\n')}\n`;
}

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
    const risposta = await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
    const corpo = (await risposta?.body())?.length ?? 0;
    await page.evaluate(NOMI);
    const misurato = await page.evaluate(() => {
      const meta = (sel: string) => document.querySelector(sel)?.getAttribute('content') ?? '';
      const tipi = new Set<string>();
      const raccogli = (nodo: unknown): void => {
        if (Array.isArray(nodo)) nodo.forEach(raccogli);
        else if (nodo && typeof nodo === 'object') {
          for (const [k, v] of Object.entries(nodo)) {
            if (k === '@type') [v].flat().forEach((t) => tipi.add(String(t)));
            else raccogli(v);
          }
        }
      };
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          raccogli(JSON.parse(s.textContent ?? ''));
        } catch {
          // JSON non valido: nessun tipo.
        }
      }
      return {
        title: document.title,
        description: meta('meta[name="description"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
        og_title: meta('meta[property="og:title"]'),
        og_description: meta('meta[property="og:description"]'),
        og_image: meta('meta[property="og:image"]'),
        og_type: meta('meta[property="og:type"]'),
        robots: meta('meta[name="robots"]'),
        h1: [...document.querySelectorAll('h1')]
          .map((h) => h.textContent?.trim() ?? '')
          .join(' | '),
        schema_types: [...tipi].sort().join(','),
      };
    });
    const oggi: Record<string, string> = {
      ...misurato,
      http: String(risposta?.status() ?? 0),
      canonical: relativo(misurato.canonical),
      og_image: relativo(misurato.og_image),
    };
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
