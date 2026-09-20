import type { ReactNode } from 'react';
import { IconButton } from '../primitives/IconButton';
import { Spinner } from '../primitives/Spinner';
import { Alert } from '../primitives/Alert';
import './PreviewPane.css';

export type PreviewViewport = 'desktop' | 'mobile';

export interface PreviewPaneProps {
  /**
   * Ciò che si disegna dentro. Deve arrivare già reso da chi usa il
   * componente con gli stessi componenti del sito pubblico (ADR-006 §3.3):
   * `packages/ui` non importa da `packages/blocks`, quindi questo componente
   * è un **contenitore**, non un motore di resa.
   */
  children: ReactNode;
  viewport: PreviewViewport;
  onViewportChange: (viewport: PreviewViewport) => void;
  onRefresh?: () => void;
  loading?: boolean;
  errorText?: string;
}

/** Componente 40: riquadro di anteprima — contenitore, commutatore schermo/telefono, aggiornamento. */
export function PreviewPane({
  children,
  viewport,
  onViewportChange,
  onRefresh,
  loading = false,
  errorText,
}: PreviewPaneProps): React.JSX.Element {
  return (
    <div className="amoris-preview-pane">
      <div className="amoris-preview-pane__toolbar">
        <div className="amoris-preview-pane__viewport" role="group" aria-label="Formato dell'anteprima">
          <button
            type="button"
            className="amoris-focusable amoris-preview-pane__viewport-button"
            aria-pressed={viewport === 'desktop'}
            onClick={() => onViewportChange('desktop')}
          >
            Schermo
          </button>
          <button
            type="button"
            className="amoris-focusable amoris-preview-pane__viewport-button"
            aria-pressed={viewport === 'mobile'}
            onClick={() => onViewportChange('mobile')}
          >
            Telefono
          </button>
        </div>
        {onRefresh ? <IconButton icon={<span aria-hidden="true">⟳</span>} label="Aggiorna l'anteprima" onClick={onRefresh} /> : null}
      </div>

      {errorText ? (
        <Alert variant="error" title="Anteprima non disponibile">
          {errorText}
        </Alert>
      ) : loading ? (
        <div className="amoris-preview-pane__status">
          <Spinner label="Aggiornamento dell'anteprima in corso…" />
        </div>
      ) : (
        <div
          className={[
            'amoris-preview-pane__frame',
            viewport === 'mobile' ? 'amoris-preview-pane__frame--mobile' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      )}
    </div>
  );
}
