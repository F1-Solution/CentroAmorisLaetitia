import type { ReactNode } from 'react';
import './Alert.css';

export type AlertVariant = 'info' | 'warning' | 'error' | 'success';

export interface AlertProps {
  variant: AlertVariant;
  title: string;
  children: ReactNode;
  /** Azione di recupero, es. "Riprova". */
  action?: ReactNode;
}

/**
 * Componente 30: riquadro di avviso in linea. Copre anche lo stato di errore E
 * richiesto dal capitolo delle primitive di base. Bordo sinistro 2 px, titolo e
 * spiegazione in italiano corrente, mai solo un'icona (§9.6).
 */
export function Alert({ variant, title, children, action }: AlertProps): React.JSX.Element {
  return (
    <div className={`amoris-alert amoris-alert--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <p className="amoris-alert__title">{title}</p>
      <div className="amoris-alert__body">{children}</div>
      {action ? <div className="amoris-alert__action">{action}</div> : null}
    </div>
  );
}
