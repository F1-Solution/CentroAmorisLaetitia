import { Spinner } from '../primitives/Spinner';
import './AuditTrail.css';

export interface AuditEntry {
  id: string;
  /**
   * Frase compiuta in italiano corrente, con il ruolo con cui l'azione è
   * stata compiuta — es. «Maria Bianchi ha pubblicato «Chi siamo» come
   * Redazione.» (§8.3 punto 5, innesto dalla proposta D).
   */
  sentence: string;
  timestamp: string;
}

export interface AuditTrailProps {
  entries: AuditEntry[];
  loading?: boolean;
  emptyText?: string;
  /** `compact` per la scheda dell'oggetto, `full` per il registro esteso di area. */
  variant?: 'compact' | 'full';
}

/**
 * Componente 48: storia breve in fondo alla scheda dell'oggetto e registro
 * esteso di area, scritto in frasi compiute e non in righe tecniche. Ogni riga
 * porta il ruolo con cui l'azione è stata compiuta.
 */
export function AuditTrail({
  entries,
  loading = false,
  emptyText = 'Nessuna operazione registrata.',
  variant = 'full',
}: AuditTrailProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="amoris-audit-trail__status">
        <Spinner label="Caricamento del registro in corso…" />
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="amoris-audit-trail__status">{emptyText}</p>;
  }

  return (
    <ul className={['amoris-audit-trail', `amoris-audit-trail--${variant}`].join(' ')}>
      {entries.map((entry) => (
        <li key={entry.id} className="amoris-audit-trail__entry">
          <p className="amoris-audit-trail__sentence">{entry.sentence}</p>
          <span className="amoris-audit-trail__timestamp">{entry.timestamp}</span>
        </li>
      ))}
    </ul>
  );
}
