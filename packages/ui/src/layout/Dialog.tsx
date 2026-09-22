import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { getFocusable, trapTabKey } from './focus-trap';
import './Dialog.css';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  loading?: boolean;
}

/**
 * Componente 32: finestra di dialogo modale, riservata alle conferme brevi.
 * Fuoco intrappolato, chiusura con Esc, ritorno del fuoco all'elemento che
 * l'ha aperta (§9.3).
 */
export function Dialog({ open, onClose, title, children, loading = false }: DialogProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
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
    const node = dialogRef.current;
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
    const node = dialogRef.current;

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
    <div className="amoris-dialog-overlay">
      <div
        ref={dialogRef}
        className="amoris-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="amoris-dialog-title"
        aria-busy={loading || undefined}
        tabIndex={-1}
      >
        <h2 id="amoris-dialog-title" className="amoris-dialog__title">
          {title}
        </h2>
        <div className="amoris-dialog__body">{children}</div>
      </div>
    </div>
  );
}
