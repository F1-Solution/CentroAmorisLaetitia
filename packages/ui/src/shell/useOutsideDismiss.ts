import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Chiude un pannello a comparsa quando si preme Esc o si interagisce fuori dal
 * contenitore. Condiviso da `UserMenu` e `RoleSwitcher`, che aprono un menu non
 * modale — a differenza di `Dialog`/`SidePanel` non intrappolano il fuoco, ma
 * devono comunque chiudersi in modo prevedibile.
 */
export function useOutsideDismiss(containerRef: RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: MouseEvent) {
      const node = containerRef.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        onDismiss();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onDismiss, containerRef]);
}
