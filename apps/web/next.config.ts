import path from 'node:path';
import type { NextConfig } from 'next';
import { apiUrl } from './src/lib/apiUrl';

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
// Le riscritture si fissano nella build: in produzione `/media/*` e `/forms/*` li instrada Caddy (ADR-003).
const API_URL = apiUrl();

const config: NextConfig = {
  // Immagine di produzione autosufficiente (1F-W2); la radice del monorepo porta con sé i pacchetti di lavoro.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
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
  // DR-284: `/.*/` porta i metadati nell'`<head>` per ogni client con user agent; senza user agent restano in streaming.
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  // Il pacchetto resta leggero: il sito pubblico deve superare PageSpeed 80 (RC-08).
  productionBrowserSourceMaps: false,
};

export default config;
