import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/open-sans.css';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/blocks.css';

/**
 * Struttura minima. L'aspetto del sito pubblico nasce in **Fase 1E**, dai design
 * token estratti dal sito attuale: qualunque scelta grafica fatta adesso sarebbe
 * da rifare, e nel frattempo confonderebbe i confronti al pixel.
 */
export const metadata: Metadata = {
  title: 'Centro per la Famiglia Amoris Laetitia',
  description: 'Fondazione della piattaforma. Il sito pubblico arriva in Fase 1E.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
