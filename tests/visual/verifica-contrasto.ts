import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Browser } from '@playwright/test';
import { avviaBrowser } from './condizioni';
import { classificaContrasto, componi, contrasto, testoGrande } from './contrasto';
import { leggiCsv } from './matrice';

/**
 * T6 della `1E-W7` (A-8): tutte le coppie testo/sfondo **usate** negli 81 URL ad
 * alta priorità, dagli stili calcolati a 1440 e 390 px, non solo dai token.
 *
 *   SITO=http://127.0.0.1:3200 pnpm exec tsx tests/visual/verifica-contrasto.ts
 *
 * Lo sfondo è il primo antenato con un colore opaco, fondendo quelli
 * semitrasparenti; un testo su immagine non si misura e si conta a parte.
 * Ripresa da `stato-contrasto.json` (HO-014). Esito in `contrasto.csv`.
 */

const RADICE = process.cwd();
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';
const CARTELLA = path.join(RADICE, 'docs/qa/screenshots/verifiche');
const STATO = path.join(CARTELLA, 'stato-contrasto.json');
const CSV = path.join(RADICE, 'docs/qa/verifiche/contrasto.csv');

interface Coppia {
  readonly testo: string;
  readonly sfondo: string;
  readonly px: number;
  readonly peso: number;
  readonly esempio: string;
  readonly suImmagine: boolean;
}

interface Aggregato {
  testo: string;
  sfondo: string;
  grande: boolean;
  occorrenze: number;
  url: Set<string>;
  esempio: string;
}

async function coppie(
  browser: Browser,
  url: string,
  width: number,
  height: number,
): Promise<Coppia[]> {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: 'it-IT',
    serviceWorkers: 'block',
  });
  try {
    await ctx.addInitScript('window.__name = (f) => f');
    const page = await ctx.newPage();
    await page.goto(`${SITO}${url}`, { waitUntil: 'networkidle', timeout: 90_000 });
    return await page.evaluate(() => {
      const parse = (c: string) => {
        const m = /rgba?\(([^)]+)\)/.exec(c);
        if (!m) return [0, 0, 0, 0];
        const p = m[1]!
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
      };
      // Lo sfondo effettivo: dal più vicino al più lontano, fondendo i semitrasparenti.
      const sfondoDi = (el: Element): { colore: string; suImmagine: boolean } => {
        const strati: number[][] = [];
        let suImmagine = false;
        for (let e: Element | null = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage))
            suImmagine = true;
          const c = parse(cs.backgroundColor);
          if (c[3]! > 0) strati.push(c);
          if (c[3] === 1) break;
        }
        let [r, g, b] = [255, 255, 255];
        for (const s of strati.reverse()) {
          const a = s[3]!;
          [r, g, b] = [s[0]! * a + r * (1 - a), s[1]! * a + g * (1 - a), s[2]! * a + b * (1 - a)];
        }
        return {
          colore: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
          suImmagine: suImmagine && strati.every((s) => s[3]! < 1),
        };
      };
      const out: {
        testo: string;
        sfondo: string;
        px: number;
        peso: number;
        esempio: string;
        suImmagine: boolean;
      }[] = [];
      const visti = new Set<Element>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || visti.has(el) || !n.textContent?.trim()) continue;
        if (el.closest('script, style, noscript, [aria-hidden="true"]')) continue;
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        visti.add(el);
        const cs = getComputedStyle(el);
        const sf = sfondoDi(el);
        out.push({
          testo: cs.color,
          sfondo: sf.colore,
          px: parseFloat(cs.fontSize),
          peso: Number(cs.fontWeight),
          esempio: n.textContent.trim().slice(0, 30),
          suImmagine: sf.suImmagine,
        });
      }
      // Il testo dei campi e il segnaposto (DR-115 ne rinvia uno).
      for (const c of Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input:not([type=hidden]):not([type=submit]):not([type=checkbox]):not([type=radio]), textarea',
        ),
      )) {
        if (!c.checkVisibility()) continue;
        const sf = sfondoDi(c);
        const cs = getComputedStyle(c);
        out.push({
          testo: cs.color,
          sfondo: sf.colore,
          px: parseFloat(cs.fontSize),
          peso: Number(cs.fontWeight),
          esempio: `campo ${c.name || c.type}`,
          suImmagine: false,
        });
        if (c.placeholder) {
          const ph = getComputedStyle(c, '::placeholder');
          out.push({
            testo: ph.color,
            sfondo: sf.colore,
            px: parseFloat(ph.fontSize),
            peso: Number(ph.fontWeight),
            esempio: `segnaposto ${c.name || c.type}`,
            suImmagine: false,
          });
        }
      }
      return out;
    });
  } finally {
    await ctx.close();
  }
}

const cella = (v: string) => `"${v.replaceAll('"', '""')}"`;

async function main(): Promise<void> {
  mkdirSync(CARTELLA, { recursive: true });
  const salvato = existsSync(STATO)
    ? (JSON.parse(readFileSync(STATO, 'utf-8')) as {
        fatti: string[];
        coppie: (Omit<Aggregato, 'url'> & { url: string[] })[];
        suImmagine: number;
      })
    : null;
  const fatti = new Set(salvato?.fatti ?? []);
  const agg = new Map<string, Aggregato>(
    (salvato?.coppie ?? []).map((c) => [
      `${c.testo}|${c.sfondo}|${c.grande}`,
      { ...c, url: new Set(c.url) },
    ]),
  );
  let suImmagine = salvato?.suImmagine ?? 0;
  const tutti = leggiCsv(path.join(RADICE, 'docs/migration/url-matrix.csv'))
    .filter((r) => r.priorita_parita === 'alta' && r.tipo !== 'sistema')
    .map((r) => r.url ?? '');
  const salva = () =>
    writeFileSync(
      STATO,
      JSON.stringify({
        fatti: [...fatti],
        suImmagine,
        coppie: [...agg.values()].map((a) => ({ ...a, url: [...a.url] })),
      }),
    );
  let browser = await avviaBrowser();
  let n = 0;
  try {
    for (const url of tutti) {
      if (fatti.has(url)) continue;
      if (n > 0 && n % 10 === 0) {
        await browser.close();
        browser = await avviaBrowser();
      }
      n += 1;
      for (const [w, h] of [
        [1440, 900],
        [390, 844],
      ] as const) {
        for (const c of await coppie(browser, url, w, h)) {
          if (c.suImmagine) {
            suImmagine += 1;
            continue;
          }
          const testo = componi(c.testo, c.sfondo);
          const grande = testoGrande(c.px, c.peso);
          const chiave = `${testo}|${c.sfondo}|${grande}`;
          const a = agg.get(chiave) ?? {
            testo,
            sfondo: c.sfondo,
            grande,
            occorrenze: 0,
            url: new Set<string>(),
            esempio: `${url} «${c.esempio}»`,
          };
          a.occorrenze += 1;
          a.url.add(url);
          agg.set(chiave, a);
        }
      }
      fatti.add(url);
      salva();
      console.log(`  [${fatti.size}/${tutti.length}] ${url}`);
    }
  } finally {
    await browser.close();
  }
  const righe = [...agg.values()]
    .map((a) => ({
      ...a,
      rapporto: contrasto(a.testo, a.sfondo),
      classe: classificaContrasto(a.testo, a.sfondo, a.grande),
    }))
    .sort((x, y) => x.rapporto - y.rapporto);
  writeFileSync(
    CSV,
    'testo,sfondo,testo_grande,rapporto,classe,occorrenze,url,esempio\n' +
      righe
        .map((r) =>
          [
            r.testo,
            r.sfondo,
            r.grande ? 'sì' : 'no',
            r.rapporto.toFixed(2),
            r.classe,
            String(r.occorrenze),
            String(r.url.size),
            r.esempio,
          ]
            .map(cella)
            .join(','),
        )
        .join('\n') +
      '\n',
  );
  console.log(
    `contrasto: ${righe.length} coppie, ${righe.filter((r) => r.classe === 'non conforme nuova').length} non conformi nuove, ${suImmagine} testi su immagine non misurati`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
