import { stripDangerousMarkup } from '@amoris/blocks';

/**
 * Piè di pagina. Il suo testo, nella sorgente, è un widget HTML dell'area
 * `sidebar-2`: non è scritto qui, perché è contenuto e va modificato dal CMS
 * (impostazione `site.footer_html`, DR-117).
 */

interface SiteFooterProps {
  readonly footerHtml: string;
}

export function SiteFooter({ footerHtml }: SiteFooterProps) {
  // Come all'import, si toglie solo il markup pericoloso: la presentazione è quella della sorgente (DR-117, DR-118).
  const html = footerHtml ? stripDangerousMarkup(footerHtml).html : '';
  return (
    <footer id="main-footer">
      {html ? (
        <div className="container">
          <div id="footer-widgets" className="clearfix">
            <div className="footer-widget">
              {/* Involucri del widget HTML della sorgente: la colonna flotta ed è larga quanto il testo (F1). */}
              <div className="widget_text fwidget et_pb_widget widget_custom_html">
                <div
                  className="textwidget custom-html-widget"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div id="footer-bottom">
        <div className="container clearfix" />
      </div>
    </footer>
  );
}
