import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { htmlLangOrDefault, siteTitleOrDefault } from '../lib/settingsOnce';
import { siteUrl } from '../lib/site';
import 'intl-tel-input/styles';
import '../styles/open-sans.css';
import '../styles/etmodules.css';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/blocks.css';
import '../styles/layout.css';

/**
 * Radice del sito pubblico (`1E-W3`, `1E-W4`): fogli di stile misurati sul
 * riferimento e lingua da «Lingua del sito» (criterio A-6, DR-270). Titolo e metadati
 * li scrive ogni pagina dalla lettura pubblica.
 */
export async function generateMetadata(): Promise<Metadata> {
  // DR-273: il titolo di riserva è «Titolo del sito», con il valore di oggi se manca o l'API non risponde.
  const title = await siteTitleOrDefault();
  // DR-188: canonical, og:url e og:image assoluti; letto alla richiesta, non alla compilazione (DR-196).
  return { title, metadataBase: new URL(`${siteUrl()}/`) };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Le impostazioni si leggono alla richiesta, mai alla compilazione (DR-105).
  await connection();
  // Come il titolo di riserva: «it» se l'API non risponde, invece di un errore su ogni pagina.
  const lang = await htmlLangOrDefault();
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
