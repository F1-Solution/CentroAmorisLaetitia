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
 *
 * `suppressHydrationWarning` sta **solo sul `body`** e riguarda **solo i suoi
 * attributi**: non nasconde nulla di ciò che c'è dentro. Serve perché diverse
 * estensioni del browser scrivono un attributo sul `body` prima che React
 * prenda in carico la pagina — `cz-shortcut-listen` di ColorZilla è quella
 * incontrata il 2026-09-23 — e React lo segnala come differenza fra server e
 * client. È rumore che non dipende dal sito, e lasciarlo lì coprirebbe le
 * differenze vere, che in Fase 1E sono la misura della parità.
 */
export const metadata: Metadata = {
  title: 'Area di gestione',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
