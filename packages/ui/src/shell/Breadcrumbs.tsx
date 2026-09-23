import type { BreadcrumbItem, NavLinkComponent } from './types';
import { DefaultNavLink } from './NavLink';
import './Breadcrumbs.css';

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /**
 * Collegamento da usare per le voci. Predefinito: un'ancora normale, che **non
 * conosce il prefisso** sotto cui l'applicazione è servita. `apps/admin` passa
 * quello di Next, che lo conosce (vedi `NavLinkComponent`).
 */
  link?: NavLinkComponent;
}

/**
 * Componente 5: percorso «Area / Sezione / Oggetto». L'ultimo elemento non è
 * cliccabile (§6) ed è marcato `aria-current="page"`.
 */
export function Breadcrumbs({ items, link: Link = DefaultNavLink }: BreadcrumbsProps): React.JSX.Element {
  return (
    <nav className="amoris-breadcrumbs" aria-label="Percorso">
      <ol className="amoris-breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="amoris-breadcrumbs__item">
              {isLast || !item.href ? (
                <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
              ) : (
                <Link className="amoris-focusable" href={item.href}>
                  {item.label}
                </Link>
              )}
              {!isLast ? (
                <span className="amoris-breadcrumbs__separator" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
