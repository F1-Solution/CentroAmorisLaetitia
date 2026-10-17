import { Fragment } from 'react';
import type { MenuItem } from '../lib/api';
import { HeaderSearchForm, HeaderSearchIcon, HeaderSearchState } from './HeaderSearch';

/**
 * Intestazione del sito, nella forma che il tema rende con lo stile «centrato» e
 * la barra fissa (`et_divi`: `header_style = centered`, `divi_fixed_nav = on`):
 * logo al centro, menu sotto. Gli identificativi di Divi restano, così che le
 * regole misurate (`docs/design/public-site-tokens.md`) si leggano sul markup.
 *
 * Sotto i 981px il menu diventa la barra «Seleziona una pagina»: un `<details>`,
 * che si apre e si chiude da tastiera senza script (criterio A-3).
 */

interface SiteHeaderProps {
  readonly siteTitle: string;
  readonly logoPath: string | null;
  readonly menu: readonly MenuItem[];
  readonly currentPath: string;
}

function isCurrent(item: MenuItem, currentPath: string): boolean {
  return item.href === currentPath || item.children.some((child) => isCurrent(child, currentPath));
}

function MenuList({
  items,
  currentPath,
  className,
  id,
}: {
  readonly items: readonly MenuItem[];
  readonly currentPath: string;
  readonly className: string;
  readonly id?: string;
}) {
  return (
    <ul className={className} id={id}>
      {items.map((item, index) => {
        const classes = [
          'menu-item',
          item.children.length > 0 ? 'menu-item-has-children' : '',
          item.href === currentPath ? 'current-menu-item' : '',
          item.href !== currentPath && isCurrent(item, currentPath) ? 'current-menu-ancestor' : '',
          item.cssClasses ?? '',
        ]
          .filter(Boolean)
          .join(' ');
        // Lo spazio fra le voci in linea è quello del markup della sorgente (E1).
        return (
          <Fragment key={item.id}>
            {index > 0 ? ' ' : null}
            <li className={classes}>
              <a
                href={item.href}
                {...(item.target ? { target: item.target } : {})}
                {...(item.target === '_blank' ? { rel: 'noopener' } : {})}
                {...(item.href === currentPath ? { 'aria-current': 'page' as const } : {})}
              >
                {item.label}
              </a>
              {item.children.length > 0 ? (
                <MenuList items={item.children} currentPath={currentPath} className="sub-menu" />
              ) : null}
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

export function SiteHeader({ siteTitle, logoPath, menu, currentPath }: SiteHeaderProps) {
  return (
    <HeaderSearchState>
      <header id="main-header">
        <div className="container clearfix et_menu_container">
          <div className="logo_container">
            {/* Elemento d'appoggio e spazio della sorgente: centrano il logo come lì (E1). */}
            <span className="logo_helper" />{' '}
            <a href="/">
              {logoPath ? (
                <img src={logoPath} alt={siteTitle} id="logo" />
              ) : (
                <span id="logo" className="logo-testo">
                  {siteTitle}
                </span>
              )}
            </a>
          </div>
          <div id="et-top-navigation">
            <nav id="top-menu-nav" aria-label="Menu principale">
              <MenuList items={menu} currentPath={currentPath} className="nav" id="top-menu" />
            </nav>{' '}
            <HeaderSearchIcon />
            <details id="et_mobile_nav_menu">
              <summary className="mobile_nav">
                <span className="select_page">Seleziona una pagina</span>
                <span className="mobile_menu_bar" aria-hidden="true" />
              </summary>
              <nav aria-label="Menu principale per telefono">
                <MenuList items={menu} currentPath={currentPath} className="et_mobile_menu" />
              </nav>
            </details>
          </div>
        </div>
        <HeaderSearchForm />
      </header>
    </HeaderSearchState>
  );
}
