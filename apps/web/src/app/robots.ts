import type { MetadataRoute } from 'next';

/**
 * L'area amministrativa non va indicizzata (ADR-008 §3.3 regola 2). Qui viene
 * esclusa anche dal `robots.txt` del sito, che e' la prima cosa che un crawler
 * legge.
 *
 * Le regole vere del sito — sitemap compresa — si scrivono in Fase 1D, quando i
 * contenuti esistono: il `robots.txt` della sorgente e' un dato da migrare, non
 * una scelta da fare adesso.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/admin' }],
  };
}
