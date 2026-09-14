import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Struttura minima. Il sistema di design dell'area amministrativa nasce in
 * **Fase 1D**, dopo la scelta di HO-004: sceglierlo qui significherebbe deciderlo
 * al posto dell'utente.
 */
export const metadata: Metadata = {
  title: 'Area di gestione',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
