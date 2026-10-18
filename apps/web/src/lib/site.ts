const PREDEFINITO_LOCALE = 'http://localhost:3000';

type Ambiente = Readonly<Record<string, string | undefined>>;

/**
 * Indirizzo assoluto del sito pubblico, senza barra finale: sitemap, `robots.txt`,
 * feed, `metadataBase` e dati strutturati (DR-176, DR-188).
 * In produzione è obbligatorio e manca solo alla prima richiesta, non alla compilazione (DR-196).
 */
export function siteUrl(env: Ambiente = process.env): string {
  const valore = env.SITE_URL?.trim() ?? '';
  if (valore === '') {
    const compilazione = env.NEXT_PHASE === 'phase-production-build';
    if (env.NODE_ENV === 'production' && !compilazione) {
      throw new Error(
        'SITE_URL è obbligatoria in produzione: impostarla con l’indirizzo pubblico del sito (es. https://www.example.org) e riavviare.',
      );
    }
    return PREDEFINITO_LOCALE;
  }
  if (!/^https?:\/\/[^/\s]+/i.test(valore)) {
    throw new Error(
      `SITE_URL non valida: serve un indirizzo http o https assoluto, non «${valore}».`,
    );
  }
  return valore.replace(/\/+$/, '');
}
