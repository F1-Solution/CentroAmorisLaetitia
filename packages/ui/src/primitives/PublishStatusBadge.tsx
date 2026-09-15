import './PublishStatusBadge.css';

export type PublishStatus = 'published' | 'draft' | 'scheduled' | 'retired';

const STATUS_LABEL: Record<PublishStatus, string> = {
  published: 'Pubblicata',
  draft: 'Bozza',
  scheduled: 'Programmata',
  retired: 'Ritirata',
};

export interface PublishStatusBadgeProps {
  status: PublishStatus;
}

/**
 * Componente 35: pastiglia di stato di pubblicazione. Il testo dice lo stato
 * («Pubblicata», «Bozza», «Programmata», «Ritirata»); il puntino e il bordo lo
 * accompagnano, non lo sostituiscono (§9.6, prestito 1).
 */
export function PublishStatusBadge({ status }: PublishStatusBadgeProps): React.JSX.Element {
  return (
    <span className={`amoris-status-badge amoris-status-badge--${status}`}>
      <span className="amoris-status-badge__dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
