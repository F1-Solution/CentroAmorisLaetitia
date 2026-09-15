import './SkipLink.css';

export interface SkipLinkProps {
  targetId: string;
}

/** Componente 53: «Vai al contenuto», primo elemento focalizzabile di ogni schermata (§9.3). */
export function SkipLink({ targetId }: SkipLinkProps): React.JSX.Element {
  return (
    <a href={`#${targetId}`} className="amoris-focusable amoris-skip-link">
      Vai al contenuto
    </a>
  );
}
