import { sanitizeRichText, stripDangerousMarkup } from '@amoris/blocks';

/**
 * Piè di pagina. Il suo testo, nella sorgente, è un widget HTML dell'area
 * `sidebar-2`: non è scritto qui, perché è contenuto e va modificato dal CMS.
 * Finché non è importato (decisione D46), il piè di pagina è vuoto.
 */

interface SiteFooterProps {
  readonly footerHtml: string;
}

/**
 * Sanificato anche qui, non solo all'import: l'elenco chiuso dei blocchi
 * `rich_text` se basta, altrimenti la sola rimozione del markup pericoloso.
 */
function safeHtml(html: string): string {
  const outcome = sanitizeRichText(html);
  return outcome.ok ? outcome.html : stripDangerousMarkup(html).html;
}

export function SiteFooter({ footerHtml }: SiteFooterProps) {
  const html = footerHtml ? safeHtml(footerHtml) : '';
  return (
    <footer id="main-footer">
      {html ? (
        <div className="container">
          <div id="footer-widgets" className="clearfix">
            <div className="footer-widget" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      ) : null}
      <div id="footer-bottom">
        <div className="container clearfix" />
      </div>
    </footer>
  );
}
