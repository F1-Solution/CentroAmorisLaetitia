import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from '../src/components/SiteFooter';

/** DR-117: il piè di pagina conserva la presentazione della sorgente, non gli script. Dati sintetici. */

describe('piè di pagina (DR-117)', () => {
  it('conserva allineamento e stili copiati, toglie il markup pericoloso', () => {
    const html = renderToStaticMarkup(
      <SiteFooter footerHtml='<div align="center">Testo sintetico <a href="/x/" style="color: #FFFFFF">link</a><script>alert(1)</script></div>' />,
    );
    expect(html).toContain('align="center"');
    expect(html).toContain('color: #FFFFFF');
    expect(html).not.toContain('<script');
  });

  it('mette il testo negli involucri del widget della sorgente, che flotta ed è largo quanto il testo (F1)', () => {
    const html = renderToStaticMarkup(<SiteFooter footerHtml="<p>Testo sintetico</p>" />);
    expect(html).toContain(
      '<div class="footer-widget"><div class="widget_text fwidget et_pb_widget widget_custom_html"><div class="textwidget custom-html-widget"><p>Testo sintetico</p></div></div></div>',
    );
  });

  it('senza testo non rende i widget', () => {
    expect(renderToStaticMarkup(<SiteFooter footerHtml="" />)).not.toContain('footer-widget');
  });
});
