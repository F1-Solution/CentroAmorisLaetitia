import type { AreaSummary } from './types';
import './AreaNav.css';

export interface AreaNavProps {
  /**
   * Solo le aree possedute dal ruolo attivo. Le quattro aree non ancora
   * costruite non compaiono affatto (DR-055, §7.3): non è compito di questo
   * componente filtrarle, è compito di chi lo usa non passargliele — qui non
   * esiste alcun elenco delle sei aree a regime.
   */
  areas: AreaSummary[];
  activeAreaId: string;
}

/** Componente 2: prima colonna, 56 px — le aree come icona con etichetta al passaggio e alla messa a fuoco. */
export function AreaNav({ areas, activeAreaId }: AreaNavProps): React.JSX.Element {
  return (
    <nav className="amoris-area-nav" aria-label="Aree">
      <ul className="amoris-area-nav__list">
        {areas.map((area) => {
          const isActive = area.id === activeAreaId;
          const itemClasses = ['amoris-focusable', 'amoris-area-nav__item', isActive ? 'amoris-area-nav__item--active' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <li key={area.id}>
              <a href={area.href} className={itemClasses} aria-current={isActive ? 'true' : undefined}>
                <span className="amoris-area-nav__icon" aria-hidden="true">
                  {area.icon}
                </span>
                <span className="amoris-area-nav__label">{area.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
