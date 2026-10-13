import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { avviaBrowser, nuovoContesto, VIEWPORT } from './condizioni';
import { bersagli } from './matrice';

/**
 * Raccolta delle coordinate delle maschere ammesse (`visual-regression-plan.md`
 * §5.1 e DR-120), misurate sul sito nuovo in esecuzione: l'area del blocco
 * `map`, l'area di ogni blocco `video`, e la tabella dei cookie a 390/360 px su
 * `/informazioni-sui-cookie/` (D49/DR-120). Le stesse coordinate si applicano,
 * identiche, alle due immagini del confronto.
 *
 *   SITO=http://127.0.0.1:3200 npx tsx tests/visual/maschere.ts
 */

const RADICE = process.cwd();
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';

interface Maschera {
  readonly url: string;
  readonly viewport: string;
  readonly motivo: string;
  readonly selettore: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

async function main(): Promise<void> {
  const browser = await avviaBrowser();
  const maschere: Maschera[] = [];
  const pagine = bersagli(RADICE);

  for (const viewport of VIEWPORT) {
    const context = await nuovoContesto(browser, viewport);
    const page = await context.newPage();
    for (const b of pagine.filter((x) => x.viewport.some((v) => v.nome === viewport.nome))) {
      const risposta = await page
        .goto(`${SITO}${b.url}`, { waitUntil: 'networkidle', timeout: 60_000 })
        .catch(() => null);
      if (!risposta || risposta.status() !== 200) continue;
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const rettangoli = await page.evaluate(() => {
        const out: {
          selettore: string;
          motivo: string;
          x: number;
          y: number;
          w: number;
          h: number;
        }[] = [];
        document.querySelectorAll('.blk-map').forEach((el) => {
          const r = el.getBoundingClientRect();
          out.push({
            selettore: '.blk-map',
            motivo: 'Mappa: tessere/errore di un servizio esterno, mai identiche due volte',
            x: Math.round(r.x + window.scrollX),
            y: Math.round(r.y + window.scrollY),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        });
        document.querySelectorAll('.blk-video').forEach((el) => {
          const r = el.getBoundingClientRect();
          out.push({
            selettore: '.blk-video',
            motivo: 'Video: copertina/anteprima di un servizio esterno',
            x: Math.round(r.x + window.scrollX),
            y: Math.round(r.y + window.scrollY),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        });
        // DR-120: la tabella dei cookie, difformità dichiarata a <=479px.
        if (window.innerWidth <= 479) {
          document.querySelectorAll('table').forEach((el) => {
            const testo = el.textContent ?? '';
            if (testo.includes('Cookie') || testo.includes('cookie')) {
              const r = el.getBoundingClientRect();
              out.push({
                selettore: 'table (cookie)',
                motivo:
                  'DR-120: tabella dei cookie più larga del riquadro, presente anche nella sorgente',
                x: Math.round(r.x + window.scrollX),
                y: Math.round(r.y + window.scrollY),
                w: Math.round(r.width),
                h: Math.round(r.height),
              });
            }
          });
        }
        return out;
      });
      for (const r of rettangoli) {
        if (r.w <= 0 || r.h <= 0) continue;
        maschere.push({
          url: b.url,
          viewport: viewport.nome,
          motivo: r.motivo,
          selettore: r.selettore,
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
        });
      }
    }
    await context.close();
  }
  await browser.close();

  mkdirSync(path.join(RADICE, 'docs/qa/confronto'), { recursive: true });
  writeFileSync(
    path.join(RADICE, 'docs/qa/confronto/maschere.json'),
    `${JSON.stringify(maschere, null, 1)}\n`,
  );
  console.log(`maschere trovate: ${maschere.length}`);
  for (const m of maschere)
    console.log(`  ${m.url} ${m.viewport} ${m.selettore} (${m.x},${m.y} ${m.w}x${m.h})`);
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exitCode = 1;
});
