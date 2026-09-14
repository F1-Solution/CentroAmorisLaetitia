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
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Il pacchetto resta leggero: il sito pubblico deve superare PageSpeed 80 (RC-08).
  productionBrowserSourceMaps: false,
};

export default config;
