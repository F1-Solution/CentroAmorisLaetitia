import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from '../primitives/IconButton';
import { getFocusable, trapTabKey } from './focus-trap';
import './SidePanel.css';

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  loading?: boolean;
  errorText?: string;
}

/**
 * Componente 33: pannello da destra, 480 px (§4.2), per tutto ciò che non è una
 * conferma breve. Stessa disciplina di fuoco di `Dialog` (§9.3).
 *
 * Il comando di chiusura **è visibile**, non solo Esc: fino al 2026-09-23 si
 * usciva unicamente con una scorciatoia da tastiera, e chi non la conosce non
 * aveva alcuna via d'uscita apparente. §9.6 vieta che una cosa necessaria abbia
 * un solo veicolo; Esc resta, sono due strade per la stessa azione.
 */
export function SidePanel({
  open,
  onClose,
  title,
  children,
  loading = false,
  errorText,
}: SidePanelProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  /**
   * Il fuoco si sposta **all'apertura e basta**, e questo effetto dipende dalla
   * sola apertura.
   *
   * Tenere `onClose` fra le dipendenze — come faceva fino al 2026-09-22 —
   * rieseguiva l'effetto a ogni resa, perché chi lo usa scrive quasi sempre una
   * funzione in linea, che è nuova ogni volta. Il risultato era che scrivendo
   * nel secondo campo il fuoco tornava al primo dopo ogni lettera. Un solo
   * carattere finiva dove si voleva.
   */
  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    if (node) {
      const focusable = getFocusable(node);
      (focusable[0] ?? node).focus();
    }

    return () => {
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // La tastiera, invece, ha bisogno della `onClose` corrente: l'ascoltatore si
  // riaggancia quando cambia, e non tocca il fuoco.
  useEffect(() => {
    if (!open) return undefined;
    const node = panelRef.current;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (node) trapTabKey(node, event);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="amoris-sidepanel-overlay">
      <aside
        ref={panelRef}
        className="amoris-sidepanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="amoris-sidepanel-title"
        aria-busy={loading || undefined}
        tabIndex={-1}
      >
        <div className="amoris-sidepanel__header">
          <h2 id="amoris-sidepanel-title" className="amoris-sidepanel__title">
            {title}
          </h2>
          <IconButton
            icon={<span aria-hidden="true">✕</span>}
            label="Chiudi il pannello"
            onClick={onClose}
          />
        </div>
        {errorText ? (
          <p className="amoris-sidepanel__error" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="amoris-sidepanel__body">{children}</div>
      </aside>
    </div>
  );
}
