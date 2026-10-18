'use client';

import type { KeyboardEvent, ReactNode } from 'react';

/** Il `<details>` del menu per telefono: Esc lo chiude e riporta il fuoco sulla barra (A3-1, DR-169). */
export function MobileNavDetails({ children }: { readonly children: ReactNode }) {
  function onKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    const details = event.currentTarget;
    if (event.key !== 'Escape' || !details.open) return;
    event.preventDefault();
    details.open = false;
    details.querySelector('summary')?.focus();
  }

  return (
    <details id="et_mobile_nav_menu" onKeyDown={onKeyDown}>
      {children}
    </details>
  );
}
