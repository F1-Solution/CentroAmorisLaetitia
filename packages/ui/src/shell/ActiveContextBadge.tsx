import './ActiveContextBadge.css';

export interface ActiveContextBadgeProps {
  /** Nome dell'area del ruolo attivo, ad esempio «Redazione». */
  areaLabel: string;
}

/**
 * Componente 8: indicatore **permanente** dell'ambiente attivo, in cima a ogni
 * schermata. Il veicolo primario è la frase compiuta (§9.6): non un'icona, non
 * un colore soltanto. Il puntino è un terzo segnale decorativo, `aria-hidden`.
 */
export function ActiveContextBadge({ areaLabel }: ActiveContextBadgeProps): React.JSX.Element {
  return (
    <p className="amoris-active-context-badge">
      <span className="amoris-active-context-badge__dot" aria-hidden="true" />
      Stai lavorando come {areaLabel}
    </p>
  );
}
