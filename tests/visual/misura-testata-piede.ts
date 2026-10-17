/** Misure di testata e piè di pagina, sorgente contro sito nuovo (analisi E-F della `1E-W6`): PAGINA=/chi-siamo/ npx tsx tests/visual/misura-testata-piede.ts */
import { avviaBrowser, nuovoContesto } from './condizioni';
import { VIEWPORT } from './condizioni';
const SITI = { rif: 'http://localhost:8088', nuovo: 'http://127.0.0.1:3200' };
async function main(): Promise<void> {
  const b = await avviaBrowser();
  const path = process.env.PAGINA ?? '/chi-siamo/';
  for (const vp of VIEWPORT.filter((v) => ['1440', '1024', '768', '390'].includes(v.nome))) {
    for (const [nome, base] of Object.entries(SITI)) {
      const ctx = await nuovoContesto(b, vp);
      const p = await ctx.newPage();
      await p.goto(base + path, { waitUntil: 'load', timeout: 60000 });
      await p.waitForTimeout(800);
      const r = await p.evaluate(() => {
        const R = (e: Element | null) => { if (!e) return null; const x = e.getBoundingClientRect(); return [Math.round(x.left*10)/10, Math.round(x.top*10)/10, Math.round(x.width*10)/10, Math.round(x.height*10)/10]; };
        const cs = (e: Element | null, ps?: string, k: string[] = []) => { if (!e) return null; const s = getComputedStyle(e, ps); return Object.fromEntries(k.map((x) => [x, s.getPropertyValue(x)])); };
        const top = document.querySelector('#top-menu');
        const lis = [...document.querySelectorAll('#top-menu > li')].map((li) => {
          const a = li.querySelector(':scope > a');
          return { t: a?.textContent?.trim().slice(0, 12), li: R(li), a: R(a), aSt: cs(a, undefined, ['font-size','font-weight','padding-right','padding-bottom','line-height','letter-spacing','color']), after: li.classList.contains('menu-item-has-children') ? cs(a, '::after', ['content','font-family','position','right','top','font-size','display']) : null };
        });
        return {
          header: R(document.querySelector('#main-header')), headerSt: cs(document.querySelector('#main-header'), undefined, ['box-shadow','background-color','position','padding-top']),
          logo: R(document.querySelector('#logo')), nav: R(document.querySelector('#et-top-navigation')), topMenu: R(top),
          search: R(document.querySelector('#et_top_search')), searchIcon: cs(document.querySelector('#et_search_icon'), '::before', ['content','font-family','font-size','color']),
          mobile: R(document.querySelector('#et_mobile_nav_menu')), mobileBar: R(document.querySelector('.mobile_nav')), mobileSt: cs(document.querySelector('.mobile_nav'), undefined, ['background-color','padding-top','padding-left','border-top','font-size']),
          lis: lis.slice(0, 4),
          pageContainerPad: cs(document.querySelector('#page-container'), undefined, ['padding-top','margin-top']),
          footer: R(document.querySelector('#main-footer')), footerSt: cs(document.querySelector('#main-footer'), undefined, ['background-color']),
          fwidgets: R(document.querySelector('#footer-widgets')), fwSt: cs(document.querySelector('#footer-widgets'), undefined, ['padding-top','padding-bottom']),
          fcol: R(document.querySelector('#footer-widgets .footer-widget')), fcolSt: cs(document.querySelector('#footer-widgets .footer-widget'), undefined, ['width','margin-right','margin-bottom','float','text-align']),
          fwidget: R(document.querySelector('#footer-widgets .footer-widget > *')),
          fp: [...document.querySelectorAll('#footer-widgets p')].slice(0,3).map((e) => ({ r: R(e), s: cs(e, undefined, ['font-size','line-height','text-align','color','padding-bottom','margin-bottom']) })),
          fbottom: R(document.querySelector('#footer-bottom')), fbSt: cs(document.querySelector('#footer-bottom'), undefined, ['padding-top','padding-bottom','background-color']),
          fbChildren: [...document.querySelectorAll('#footer-bottom *')].map((e) => e.tagName + '#' + e.id + '.' + (e.className && typeof e.className === 'string' ? e.className : '') + ' ' + JSON.stringify(R(e))).slice(0, 8),
          docH: document.documentElement.scrollHeight,
        };
      });
      console.log(`### ${vp.nome} ${nome}\n` + JSON.stringify(r));
      await ctx.close();
    }
  }
  await b.close();
}
void main();
