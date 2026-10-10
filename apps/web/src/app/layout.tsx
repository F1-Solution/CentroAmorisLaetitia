import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/open-sans.css';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/blocks.css';
import '../styles/layout.css';

/**
 * Radice del sito pubblico (`1E-W3`, `1E-W4`): fogli di stile misurati sul
 * riferimento e lingua italiana (criterio A-6). Titolo e metadati li scrive ogni
 * pagina dalla lettura pubblica.
 */
export const metadata: Metadata = {
  title: 'Centro Amoris Laetitia',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
