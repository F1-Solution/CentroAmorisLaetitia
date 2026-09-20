import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
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

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    if (node) {
      const focusable = getFocusable(node);
      (focusable[0] ?? node).focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (node) trapTabKey(node, event);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
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
        <h2 id="amoris-sidepanel-title" className="amoris-sidepanel__title">
          {title}
        </h2>
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
