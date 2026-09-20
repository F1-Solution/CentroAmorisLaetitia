import '@amoris/ui/tokens.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';

/**
 * ADR-008: applicazione distinta e **non indicizzata**. `robots` resta qui e
 * non si tocca: l'area amministrativa non ha alcuna ragione di comparire in un
 * motore di ricerca, e la regola vale per ogni schermata, non per la radice.
 *
 * `tokens.css` è il primo import del file: dichiara le variabili di colore, la
 * scala tipografica, la densità e il `@font-face` di Inter, e ogni altro stile
 * le presuppone già definite.
 */
export const metadata: Metadata = {
  title: 'Area di gestione',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
