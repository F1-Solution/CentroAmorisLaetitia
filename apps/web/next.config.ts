import type { NextConfig } from 'next';

/**
 * Sito pubblico.
 *
 * Due regole di ADR-008 §3.3 si attuano qui e vanno lette come vincoli, non come
 * preferenze:
 *
 * 1. **Nessun service worker e nessun manifest**, per tutta la Fase 1 e finché il
 *    gate non è superato. Un service worker può servire una pagina vecchia e
 *    falsare i confronti visivi della Fase 1E: a quel punto i confronti sono da
 *    rifare, non da interpretare.
 * 2. **Nessun import da `@amoris/ui`**: quei componenti sono dell'area
 *    amministrativa, che DR-018 vuole visivamente distinta. La regola è verificata
 *    dal lint, in `eslint.config.js`.
 */
const API_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3002'
).replace(/\/$/, '');

const config: NextConfig = {
  reactStrictMode: true,
  // Gli indirizzi della sorgente finiscono con la barra (`/chi-siamo/`): restano così.
  trailingSlash: true,
  /**
   * I file dei media li serve l'API (ADR-004 §3.6). In produzione Caddy instrada
   * `/media/*` prima di arrivare qui (ADR-003); in sviluppo, senza Caddy, lo fa
   * questa riscrittura.
   */
  async rewrites() {
    return [
      { source: '/media/:path*', destination: `${API_URL}/media/:path*` },
      // L'invio dei form (ADR-010 §4.3): il browser chiama lo stesso dominio, senza CORS.
      { source: '/forms/:path*', destination: `${API_URL}/forms/:path*` },
    ];
  },
  poweredByHeader: false,
  // Il pacchetto resta leggero: il sito pubblico deve superare PageSpeed 80 (RC-08).
  productionBrowserSourceMaps: false,
};

export default config;
