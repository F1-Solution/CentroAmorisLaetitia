import type { NavLinkComponent, NavSectionGroup } from './types';
import { DefaultNavLink } from './NavLink';
import './SectionNav.css';

export interface SectionNavProps {
  groups: NavSectionGroup[];
  activeSectionId: string;
  /** Richiudibile con memoria della scelta (§6, componente 3): lo stato vive presso chi usa il componente. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /**
   * Collegamento da usare per le voci. Predefinito: un'ancora normale, che **non
   * conosce il prefisso** sotto cui l'applicazione è servita. `apps/admin` passa
   * quello di Next, che lo conosce (vedi `NavLinkComponent`).
   */
  link?: NavLinkComponent;
}

/**
 * Componente 3: seconda colonna, 240 px — le sezioni dell'area attiva,
 * raggruppate sotto etichette in maiuscoletto. Una sezione con
 * `permitted: false` **non compare** (DR-057): non è mai resa disabilitata.
 */
export function SectionNav({
  groups,
  activeSectionId,
  collapsed = false,
  onToggleCollapsed,
  link: Link = DefaultNavLink,
}: SectionNavProps): React.JSX.Element {
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) => section.permitted !== false),
    }))
    .filter((group) => group.sections.length > 0);

  if (collapsed) {
    return (
      <nav className="amoris-section-nav amoris-section-nav--collapsed" aria-label="Sezioni">
        {onToggleCollapsed ? (
          <button
            type="button"
            className="amoris-focusable amoris-section-nav__toggle"
            onClick={onToggleCollapsed}
          >
            <span className="amoris-visually-hidden">Apri le sezioni</span>
            <span aria-hidden="true">»</span>
          </button>
        ) : null}
      </nav>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <nav className="amoris-section-nav" aria-label="Sezioni">
        <p className="amoris-section-nav__empty">Nessuna sezione disponibile in questo ambiente.</p>
      </nav>
    );
  }

  return (
    <nav className="amoris-section-nav" aria-label="Sezioni">
      {onToggleCollapsed ? (
        <button
          type="button"
          className="amoris-focusable amoris-section-nav__toggle"
          onClick={onToggleCollapsed}
        >
          <span className="amoris-visually-hidden">Richiudi le sezioni</span>
          <span aria-hidden="true">«</span>
        </button>
      ) : null}
      {visibleGroups.map((group) => (
        <div key={group.id} className="amoris-section-nav__group">
          <p className="amoris-section-nav__group-label">{group.label}</p>
          <ul className="amoris-section-nav__list">
            {group.sections.map((section) => {
              const isActive = section.id === activeSectionId;
              const classes = [
                'amoris-focusable',
                'amoris-section-nav__item',
                isActive ? 'amoris-section-nav__item--active' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <li key={section.id}>
                  <Link
                    href={section.href}
                    className={classes}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
