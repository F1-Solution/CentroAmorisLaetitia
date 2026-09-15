import type { ReactNode } from 'react';
import './PageHeader.css';

export interface PageHeaderProps {
  title: string;
  /** Riga di riepilogo sotto il titolo. */
  summary?: string;
  /** Azione principale, a destra del titolo. */
  action?: ReactNode;
  loading?: boolean;
}

/** Componente 13: intestazione di schermata — titolo, riepilogo, azione principale a destra. */
export function PageHeader({ title, summary, action, loading = false }: PageHeaderProps): React.JSX.Element {
  return (
    <header className="amoris-page-header" aria-busy={loading || undefined}>
      <div className="amoris-page-header__text">
        <h1 className="amoris-page-header__title">{title}</h1>
        {summary ? <p className="amoris-page-header__summary">{summary}</p> : null}
      </div>
      {action ? <div className="amoris-page-header__action">{action}</div> : null}
    </header>
  );
}
