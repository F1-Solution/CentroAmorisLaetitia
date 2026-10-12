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

  it('senza testo non rende i widget', () => {
    expect(renderToStaticMarkup(<SiteFooter footerHtml="" />)).not.toContain('footer-widget');
  });
});
