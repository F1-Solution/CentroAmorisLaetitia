import { Button } from './Button.js';
import './SaveBar.css';

export interface SaveBarProps {
  /**
   * Frase compiuta che dichiara sempre lo stato: «Salvato 2 minuti fa»,
   * «Modifiche non salvate» (prestito 1, §6 componente 29). Mai un'icona sola.
   */
  statusText: string;
  onSave: () => void;
  onPreview?: () => void;
  /** Assente quando pubblicare non è permesso nel ruolo attivo (DR-057). */
  onPublish?: () => void;
  saving?: boolean;
  disabled?: boolean;
  errorText?: string;
}

/** Componente 29: barra fissa in fondo, dichiara sempre lo stato del salvataggio. */
export function SaveBar({
  statusText,
  onSave,
  onPreview,
  onPublish,
  saving = false,
  disabled = false,
  errorText,
}: SaveBarProps): React.JSX.Element {
  const hasError = Boolean(errorText);

  return (
    <div className="amoris-save-bar" aria-busy={saving || undefined}>
      <p className={['amoris-save-bar__status', hasError ? 'amoris-save-bar__status--error' : ''].filter(Boolean).join(' ')} role={hasError ? 'alert' : undefined}>
        {hasError ? errorText : statusText}
      </p>
      <div className="amoris-save-bar__actions">
        {onPreview ? (
          <Button variant="secondary" onClick={onPreview} disabled={disabled}>
            Anteprima
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onSave} loading={saving} disabled={disabled}>
          Salva
        </Button>
        {onPublish ? (
          <Button variant="primary" onClick={onPublish} disabled={disabled} loading={saving}>
            Pubblica
          </Button>
        ) : null}
      </div>
    </div>
  );
}
