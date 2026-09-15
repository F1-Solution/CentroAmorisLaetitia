import type { ReactNode } from 'react';
import './EmptyState.css';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  helpLink?: ReactNode;
}

/** Componente 20: titolo, una frase, azione di creazione, collegamento alla guida. Mai solo un disegno. */
export function EmptyState({ title, description, action, helpLink }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="amoris-empty-state">
      <p className="amoris-empty-state__title">{title}</p>
      <p className="amoris-empty-state__description">{description}</p>
      {action ? <div className="amoris-empty-state__action">{action}</div> : null}
      {helpLink ? <div className="amoris-empty-state__help">{helpLink}</div> : null}
    </div>
  );
}
