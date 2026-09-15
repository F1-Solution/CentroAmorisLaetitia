import { useEffect } from 'react';
import './Toast.css';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 6000;

/**
 * Componente 31: striscia per l'esito delle azioni. Persistente per gli errori,
 * 6 secondi per le conferme (§6). Annunciata alle tecnologie assistive con una
 * regione dinamica (§9.5): non è mai l'unico posto in cui compare un errore, chi
 * lo usa per un errore lo affianca sempre a un messaggio nel modulo.
 */
export function Toast({ toast, onDismiss }: ToastProps): React.JSX.Element {
  useEffect(() => {
    if (toast.variant === 'error') return undefined;
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.variant, onDismiss]);

  return (
    <div
      className={`amoris-toast amoris-toast--${toast.variant}`}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
    >
      <span className="amoris-toast__message">{toast.message}</span>
      <button type="button" className="amoris-focusable amoris-toast__dismiss" aria-label="Chiudi l'avviso" onClick={() => onDismiss(toast.id)}>
        ×
      </button>
    </div>
  );
}
