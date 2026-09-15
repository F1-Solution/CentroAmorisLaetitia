import { useDensity } from './DensityContext.js';
import './DensityToggle.css';

/**
 * Componente 49 dell'inventario. Interruttore fra densità comoda e piena
 * («compatta» nei documenti di provenienza), raggiungibile da ogni schermata
 * (§5.2). Due sole posizioni, nessuna terza densità.
 */
export function DensityToggle(): React.JSX.Element {
  const { density, setDensity } = useDensity();
  const isCompact = density === 'compact';

  return (
    <button
      type="button"
      className="amoris-focusable amoris-density-toggle"
      role="switch"
      aria-checked={isCompact}
      aria-label="Densità"
      onClick={() => setDensity(isCompact ? 'comfortable' : 'compact')}
    >
      <span className="amoris-density-toggle__label">Densità</span>
      <span className="amoris-density-toggle__value">{isCompact ? 'Piena' : 'Comoda'}</span>
    </button>
  );
}
