import type { ReactNode } from 'react';
import './RestrictedMarker.css';

export interface RestrictedMarkerProps {
  children: ReactNode;
}

/**
 * Componente 36: marcatore di contenuto riservato. Barra piena `restricted`
 * spessa 4 px su tutto il lato sinistro, etichetta testuale «RISERVATO» e icona
 * di lucchetto — prestito 3 dalla proposta 4 «Quaderno» (§9.6): la barra e
 * l'icona non sono un ripiego del testo, lo affiancano.
 */
export function RestrictedMarker({ children }: RestrictedMarkerProps): React.JSX.Element {
  return (
    <div className="amoris-restricted-marker">
      <div className="amoris-restricted-marker__label">
        <span aria-hidden="true">🔒</span>
        RISERVATO
      </div>
      <div className="amoris-restricted-marker__content">{children}</div>
    </div>
  );
}
