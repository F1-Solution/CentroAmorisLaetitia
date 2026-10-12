import { describe, expect, it } from 'vitest';
import { footerHtml, logoStorageKey } from '../../../src/stages/contents/themeSettings.js';
import type { SqlRow } from '../../../src/source/sql/types.js';

/**
 * Logo e piè di pagina dalle opzioni del tema e dai widget (DR-117). Le opzioni
 * sono serializzate come le salva PHP; testi e indirizzi sono sintetici.
 */

const s = (value: string) => `s:${Buffer.byteLength(value)}:"${value}";`;

const options: SqlRow[] = [
  {
    option_name: 'et_divi',
    option_value: `a:2:{${s('divi_logo')}${s('https://www.centroamorislaetitia.it/wp-content/uploads/2017/09/logo%20sintetico.png')}${s('header_style')}${s('centered')}}`,
  },
  {
    option_name: 'sidebars_widgets',
    option_value: `a:3:{${s('sidebar-1')}a:1:{i:0;${s('text-9')}}${s('sidebar-2')}a:2:{i:0;${s('custom_html-2')}i:1;${s('text-3')}}${s('array_version')}i:3;}`,
  },
  {
    option_name: 'widget_custom_html',
    option_value: `a:1:{i:2;a:1:{${s('content')}${s('<div align="center">Testo sintetico <a href="http://www.centroamorislaetitia.it/pagina-sintetica/" style="color: #FFFFFF">collegamento</a><script>alert(1)</script></div>')}}}`,
  },
  {
    option_name: 'widget_text',
    option_value: `a:2:{i:3;a:1:{${s('text')}${s('<p>Secondo widget</p>')}}i:9;a:1:{${s('text')}${s('<p>Barra laterale, non piè di pagina</p>')}}}`,
  },
];

describe('logo e piè di pagina (DR-117)', () => {
  it('la chiave del logo è il percorso dopo uploads, decodificato', () => {
    expect(logoStorageKey(options)).toBe('2017/09/logo sintetico.png');
  });

  it('il piè di pagina unisce i widget delle sue aree, nell’ordine, senza la barra laterale', () => {
    const html = footerHtml(options) ?? '';
    expect(html).toContain('Testo sintetico');
    expect(html.indexOf('Testo sintetico')).toBeLessThan(html.indexOf('Secondo widget'));
    expect(html).not.toContain('Barra laterale');
  });

  it('i collegamenti al sito diventano relativi; la presentazione resta, gli script no', () => {
    const html = footerHtml(options) ?? '';
    expect(html).toContain('href="/pagina-sintetica/"');
    expect(html).toContain('align="center"');
    expect(html).toContain('color: #FFFFFF');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('centroamorislaetitia.it');
  });

  it('senza opzioni non inventa nulla', () => {
    expect(logoStorageKey([])).toBeNull();
    expect(footerHtml([])).toBeNull();
  });
});
