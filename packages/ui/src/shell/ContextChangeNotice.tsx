import { useEffect } from 'react';
import './ContextChangeNotice.css';

export interface ContextChangeNoticeProps {
  roleLabel: string;
  visible: boolean;
  onDismiss: () => void;
  /** Durata in millisecondi, predefinita 4000 (§6, componente 9). */
  durationMs?: number;
}

/**
 * Componente 9: striscia che per 4 secondi dichiara il nuovo ruolo subito dopo
 * la commutazione. `role="status"` la annuncia alle tecnologie assistive senza
 * spostare il fuoco.
 */
export function ContextChangeNotice({
  roleLabel,
  visible,
  onDismiss,
  durationMs = 4000,
}: ContextChangeNoticeProps): React.JSX.Element | null {
  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [visible, onDismiss, durationMs]);

  if (!visible) return null;

  return (
    <div className="amoris-context-change-notice" role="status">
      Stai ora lavorando come {roleLabel}
    </div>
  );
}
