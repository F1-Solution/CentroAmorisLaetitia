import { cloneElement, useId, useState } from 'react';
import type { ReactElement } from 'react';
import './Tooltip.css';

export interface TooltipProps {
  content: string;
  children: ReactElement<{ 'aria-describedby'?: string; onFocus?: () => void; onBlur?: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void }>;
}

/**
 * Componente 51: suggerimento al passaggio **e alla messa a fuoco**. Non è mai
 * l'unico veicolo di un'informazione necessaria (§9.6): il contenuto che
 * `Tooltip` avvolge deve restare comprensibile anche senza di esso.
 */
export function Tooltip({ content, children }: TooltipProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const id = useId();

  const trigger = cloneElement(children, {
    'aria-describedby': id,
    onFocus: () => setVisible(true),
    onBlur: () => setVisible(false),
    onMouseEnter: () => setVisible(true),
    onMouseLeave: () => setVisible(false),
  });

  return (
    <span className="amoris-tooltip-wrapper">
      {trigger}
      <span id={id} role="tooltip" className="amoris-tooltip" hidden={!visible}>
        {content}
      </span>
    </span>
  );
}
