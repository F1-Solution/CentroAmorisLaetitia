/** Testata con la ricerca aperta, sorgente contro sito nuovo (E3 della `1E-W6`): USCITA=cartella npx tsx tests/visual/ricerca-aperta.ts */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { avviaBrowser, nuovoContesto, VIEWPORT } from './condizioni';
const SITI = { rif: 'http://localhost:8088', nuovo: 'http://127.0.0.1:3200' };
async function main(): Promise<void> {
  const uscita = process.env.USCITA ?? 'ricerca-aperta';
  mkdirSync(uscita, { recursive: true });
  const b = await avviaBrowser();
  const path = process.env.PAGINA ?? '/chi-siamo/';
  for (const vp of VIEWPORT.filter((v) => ['1440', '1024', '768', '390'].includes(v.nome))) {
    for (const [nome, base] of Object.entries(SITI)) {
      const ctx = await nuovoContesto(b, vp);
      const p = await ctx.newPage();
      await p.goto(base + path, { waitUntil: 'load', timeout: 60000 });
      await p.waitForTimeout(800);
      const icona = p.locator('#et_search_icon');
      const visibile = await p.evaluate(() => { const e = document.querySelector('#et_top_search'); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; });
      if (visibile) {
        await icona.dispatchEvent('click');
        await p.waitForTimeout(1200);
      }
      const r = await p.evaluate(() => {
        const R = (e: Element | null) => { if (!e) return null; const x = e.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)]; };
        const cs = (e: Element | null, ps: string | undefined, k: string[]) => { if (!e) return null; const s = getComputedStyle(e, ps); return Object.fromEntries(k.map((x) => [x, s.getPropertyValue(x)])); };
        const campo = document.querySelector('.et-search-field');
        return {
          contenitore: R(document.querySelector('.et_search_form_container')),
          contenitoreSt: cs(document.querySelector('.et_search_form_container'), undefined, ['opacity', 'max-width', 'display']),
          campo: R(campo),
          campoSt: cs(campo, undefined, ['font-size', 'color', 'font-family', 'letter-spacing']),
          segnaposto: cs(campo, '::placeholder', ['color']),
          chiudi: R(document.querySelector('.et_close_search_field')),
          chiudiSt: cs(document.querySelector('.et_close_search_field'), '::after', ['content', 'font-family', 'font-size', 'color']),
          menu: cs(document.querySelector('#et-top-navigation, .et_menu_container'), undefined, ['opacity', 'visibility']),
          attivo: document.activeElement?.className ?? null,
        };
      });
      await p.screenshot({ path: join(uscita, `${vp.nome}-${nome}.png`), clip: { x: 0, y: 0, width: vp.width, height: Math.min(200, vp.height) } });
      let invio: string | null = null;
      if (visibile) {
        await p.locator('.et-search-field').fill('corso');
        await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.keyboard.press('Enter')]);
        invio = new URL(p.url()).pathname + new URL(p.url()).search;
      }
      console.log(JSON.stringify({ vp: vp.nome, sito: nome, iconaVisibile: visibile, invio, ...r }));
      await ctx.close();
    }
  }
  await b.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
