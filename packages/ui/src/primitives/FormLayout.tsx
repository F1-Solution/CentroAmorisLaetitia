import type { ReactNode } from 'react';
import './FormLayout.css';

export interface FormLayoutProps {
  /** Contenuto, colonna sinistra sopra `bp-md`. */
  main: ReactNode;
  /** Attributi (pubblicazione, visibilità, SEO…), colonna destra sopra `bp-md`. */
  aside: ReactNode;
}

/**
 * Componente 28: due colonne sopra `bp-md` (900 px, §4.3), una colonna sotto.
 * Il punto di rottura è in CSS: nessuna misura a schermo in JavaScript.
 */
export function FormLayout({ main, aside }: FormLayoutProps): React.JSX.Element {
  return (
    <div className="amoris-form-layout">
      <div className="amoris-form-layout__main">{main}</div>
      <div className="amoris-form-layout__aside">{aside}</div>
    </div>
  );
}
