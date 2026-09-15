import type { BreadcrumbItem } from './types.js';
import './Breadcrumbs.css';

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Componente 5: percorso «Area / Sezione / Oggetto». L'ultimo elemento non è
 * cliccabile (§6) ed è marcato `aria-current="page"`.
 */
export function Breadcrumbs({ items }: BreadcrumbsProps): React.JSX.Element {
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
                <a className="amoris-focusable" href={item.href}>
                  {item.label}
                </a>
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
