import { Spinner } from '../primitives/Spinner.js';
import { Alert } from '../primitives/Alert.js';
import type { AreaSummary } from './types.js';
import './AreaChoiceScreen.css';

export interface AreaChoiceScreenProps {
  /** Le aree possedute dalla persona. */
  areas: AreaSummary[];
  onChoose: (areaId: string) => void;
  loading?: boolean;
  errorText?: string;
}

/**
 * Componente 10: schermata di scelta all'accesso (§7.4 punto 1, DR-050).
 *
 * **Chi possiede una sola area non la vede**: il componente rende `null` e chi
 * lo usa entra direttamente nella «Situazione dell'area» corrispondente, senza
 * incontrare mai una scelta finta fra un'opzione sola. Con **zero** aree non è
 * una scelta finta nemmeno quella: è un errore di provisioning, mostrato con
 * `Alert`, non con una griglia vuota.
 */
export function AreaChoiceScreen({ areas, onChoose, loading = false, errorText }: AreaChoiceScreenProps): React.JSX.Element | null {
  // Una sola area: nessuna scelta da fare, il componente non si rende. Zero
  // aree, invece, non è una scelta finta: è un errore di provisioning, e
  // resta da mostrare con `errorText` (sotto), non da nascondere allo stesso modo.
  if (areas.length === 1) return null;

  return (
    <div className="amoris-area-choice-screen">
      <h1 className="amoris-area-choice-screen__title">Con quale area vuoi lavorare?</h1>
      {errorText ? (
        <Alert variant="error" title="Non è stato possibile caricare le aree">
          {errorText}
        </Alert>
      ) : null}
      {loading ? (
        <Spinner label="Caricamento delle aree in corso" />
      ) : (
        <div className="amoris-area-choice-screen__grid" role="list">
          {areas.map((area) => (
            <div key={area.id} role="listitem">
              <button
                type="button"
                className="amoris-focusable amoris-area-choice-screen__tile"
                onClick={() => onChoose(area.id)}
              >
                <span className="amoris-area-choice-screen__icon" aria-hidden="true">
                  {area.icon}
                </span>
                <span className="amoris-area-choice-screen__label">{area.label}</span>
                {typeof area.openCount === 'number' ? (
                  <span className="amoris-area-choice-screen__count">{area.openCount} elementi aperti</span>
                ) : null}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
