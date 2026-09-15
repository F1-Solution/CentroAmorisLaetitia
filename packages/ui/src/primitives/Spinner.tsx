import './Spinner.css';

export interface SpinnerProps {
  /** Testo accompagnatorio, obbligatorio: l'attesa non si comunica solo con l'animazione. */
  label: string;
}

/** Componente 52: indicatore di attesa con testo accompagnatorio. */
export function Spinner({ label }: SpinnerProps): React.JSX.Element {
  return (
    <div className="amoris-spinner" role="status">
      <span className="amoris-spinner__circle" aria-hidden="true" />
      <span className="amoris-spinner__label">{label}</span>
    </div>
  );
}
