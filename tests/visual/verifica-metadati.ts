import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { avviaBrowser } from './condizioni';
import { classificaCampo, esitoFiglieSitemap, type EsitoMetadato } from './classifica-metadati';
import { leggiCsv } from './matrice';
import { CAMPI, csv, leggiMetadati, relativo, type Metadati } from './metadati';

/**
 * Criterio 1E-8 (`1E-W7`, T1): metadati del sito nuovo contro
 * `seo-rendered-baseline.csv` (117 URL), più `robots.txt`, sitemap e feed
 * (`visual-regression-plan.md` §9) confrontati con l'istanza di riferimento.
 *
 *   SITO=http://127.0.0.1:3200 WPREF_URL=http://localhost:8088 \
 *     pnpm exec tsx tests/visual/verifica-metadati.ts
 */

const RADICE = process.cwd();
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';
const RIF = process.env.WPREF_URL ?? 'http://localhost:8088';
const ESITI = path.join(RADICE, 'docs/qa/verifiche');

const vuoti = (): Metadati => Object.fromEntries(CAMPI.map((c) => [c, ''])) as Metadati;

/** Feed e file di sistema non sono HTML: se ne leggono stato e titolo del canale. */
async function leggiTesto(indirizzo: string): Promise<{ http: string; corpo: string }> {
  const r = await fetch(indirizzo, { redirect: 'manual' });
  return { http: String(r.status), corpo: await r.text() };
}

const titoloDelCanale = (xml: string): string =>
  /<channel>\s*<title>([^<]*)<\/title>/.exec(xml)?.[1]?.trim() ?? '';

const elementi = (xml: string): number => (xml.match(/<item>/g) ?? []).length;

/** I percorsi di una sitemap, indice compreso (le figlie si leggono una per una). */
async function percorsiDellaSitemap(
  base: string,
): Promise<{ figlie: number; percorsi: Set<string> }> {
  const { corpo } = await leggiTesto(`${base}/sitemap.xml`);
  const loc = (xml: string) =>
    [...xml.matchAll(/<loc>(?:<!\[CDATA\[)?([^<\]]+)/g)].map((m) => relativo(m[1]!.trim()));
  if (!corpo.includes('<sitemapindex')) return { figlie: 0, percorsi: new Set(loc(corpo)) };
  const figlie = loc(corpo);
  const percorsi = new Set<string>();
  for (const figlia of figlie) {
    for (const p of loc((await leggiTesto(`${base}${figlia}`)).corpo)) percorsi.add(p);
  }
  return { figlie: figlie.length, percorsi };
}

/** Le righe di `robots.txt` senza l'origine, ordinate e senza differenze di maiuscole nelle chiavi. */
const righeRobots = (testo: string): string[] =>
  testo
    .split('\n')
    .map((r) =>
      relativo(r.trim().replace(/^[^:]+:/, (k) => k.toLowerCase())).replace(
        /: https?:\/\/[^/]+/,
        ': ',
      ),
    )
    .filter(Boolean)
    .sort();

const ROBOTS_DR176 = ['disallow: /admin', 'sitemap: /sitemap.xml', 'user-agent: *'];

async function verificaSistema(): Promise<string[][]> {
  const righe: string[][] = [['voce', 'sorgente', 'sito', 'esito', 'nota']];
  const [robR, robS] = [
    righeRobots((await leggiTesto(`${RIF}/robots.txt`)).corpo),
    righeRobots((await leggiTesto(`${SITO}/robots.txt`)).corpo),
  ];
  const soloR = robR.filter((r) => !robS.includes(r));
  const soloS = robS.filter((r) => !robR.includes(r));
  // DR-176: solo `Disallow: /admin` e la sitemap assoluta, nessuna regola WordPress.
  const voluto = robS.join(' ; ') === ROBOTS_DR176.join(' ; ');
  righe.push([
    'robots.txt',
    robR.join(' ; '),
    robS.join(' ; '),
    soloR.length + soloS.length === 0 ? 'identico' : voluto ? 'correzione DR-176' : 'difforme',
    soloR.length + soloS.length === 0
      ? ''
      : `solo sorgente: ${soloR.join(' ; ')} | solo sito: ${soloS.join(' ; ')}`,
  ]);

  const [smR, smS] = [await percorsiDellaSitemap(RIF), await percorsiDellaSitemap(SITO)];
  const mancanti = [...smR.percorsi].filter((p) => !smS.percorsi.has(p)).sort();
  const inPiu = [...smS.percorsi].filter((p) => !smR.percorsi.has(p)).sort();
  righe.push([
    'sitemap: figlie',
    String(smR.figlie),
    String(smS.figlie),
    // DR-177: sitemap unica al posto dell'indice con le figlie della sorgente.
    esitoFiglieSitemap(smR.figlie, smS.figlie),
    '',
  ]);
  righe.push([
    'sitemap: percorsi',
    String(smR.percorsi.size),
    String(smS.percorsi.size),
    mancanti.length + inPiu.length === 0 ? 'identico' : 'difforme',
    mancanti.length + inPiu.length === 0
      ? ''
      : `mancanti: ${mancanti.join(' ')} | in più: ${inPiu.join(' ')}`,
  ]);

  for (const feed of ['/feed/', '/category/news/feed/']) {
    const [r, s] = [
      (await leggiTesto(`${RIF}${feed}`)).corpo,
      (await leggiTesto(`${SITO}${feed}`)).corpo,
    ];
    righe.push([
      `feed ${feed}: elementi`,
      String(elementi(r)),
      String(elementi(s)),
      elementi(r) === elementi(s) ? 'identico' : 'difforme',
      '',
    ]);
  }
  return righe;
}

async function main(): Promise<void> {
  mkdirSync(ESITI, { recursive: true });
  const attesi = leggiCsv(path.join(RADICE, 'docs/migration/seo-rendered-baseline.csv'));
  const browser = await avviaBrowser();
  const page = await (
    await browser.newContext({ javaScriptEnabled: false, locale: 'it-IT' })
  ).newPage();

  const perUrl: string[][] = [['url', 'tipo', 'esito', 'corretti', 'difformi']];
  const dettaglio: string[][] = [['url', 'campo', 'esito', 'motivo', 'sorgente', 'sito']];
  const conta: Record<EsitoMetadato, number> = { identico: 0, 'correzione DR-040': 0, difforme: 0 };

  for (const atteso of attesi) {
    const url = atteso.url ?? '';
    let sito: Metadati;
    if (atteso.tipo === 'feed' || atteso.tipo === 'sistema') {
      const { http, corpo } = await leggiTesto(`${SITO}${url}`);
      sito = { ...vuoti(), http, title: atteso.tipo === 'feed' ? titoloDelCanale(corpo) : '' };
    } else {
      sito = (await leggiMetadati(page, `${SITO}${url}`)).valori;
    }
    const corretti: string[] = [];
    const difformi: string[] = [];
    for (const campo of CAMPI) {
      const rif =
        campo === 'canonical' || campo === 'og_image'
          ? relativo(atteso[campo] ?? '')
          : (atteso[campo] ?? '');
      const { esito, motivo } = classificaCampo(campo, rif, sito[campo], url);
      if (esito === 'identico') continue;
      (esito === 'difforme' ? difformi : corretti).push(campo);
      dettaglio.push([url, campo, esito, motivo, rif, sito[campo]]);
    }
    const esito: EsitoMetadato = difformi.length
      ? 'difforme'
      : corretti.length
        ? 'correzione DR-040'
        : 'identico';
    conta[esito] += 1;
    perUrl.push([url, atteso.tipo ?? '', esito, corretti.join(' '), difformi.join(' ')]);
  }
  await browser.close();

  writeFileSync(path.join(ESITI, 'metadati-per-url.csv'), csv(perUrl));
  writeFileSync(path.join(ESITI, 'metadati-dettaglio.csv'), csv(dettaglio));
  writeFileSync(path.join(ESITI, 'metadati-sistema.csv'), csv(await verificaSistema()));
  console.log(
    `metadati: ${attesi.length} URL — identici ${conta.identico}, solo correzioni DR-040 ${conta['correzione DR-040']}, difformi ${conta.difforme}`,
  );
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
