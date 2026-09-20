import { Button } from '../primitives/Button';
import './CrossAreaHandoff.css';

export interface CrossAreaHandoffProps {
  /** Nome dell'area in cui vive il dato, ad esempio «Segreteria». */
  areaLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

/**
 * Componente 11: rimando esplicito quando un dato vive in un'altra area.
 * Passare è un cambio di ambiente **tracciato**, mai un salto silenzioso
 * (§8.2 punto 5): per questo la conferma è un gesto esplicito con `Button`, non
 * un collegamento che naviga da solo.
 */
export function CrossAreaHandoff({ areaLabel, onConfirm, onDismiss, loading = false }: CrossAreaHandoffProps): React.JSX.Element {
  return (
    <div className="amoris-cross-area-handoff" role="status">
      <p className="amoris-cross-area-handoff__text">
        Questo dato sta in <strong>{areaLabel}</strong>. Vuoi passare?
      </p>
      <div className="amoris-cross-area-handoff__actions">
        <Button variant="primary" loading={loading} onClick={onConfirm}>
          Passa a {areaLabel}
        </Button>
        <Button variant="tertiary" onClick={onDismiss} disabled={loading}>
          Resta qui
        </Button>
      </div>
    </div>
  );
}
