import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/site';

/**
 * `robots.txt` del sito (DR-176): l'area amministrativa resta esclusa
 * (ADR-008 §3.3 regola 2) e la sitemap si dichiara con l'indirizzo assoluto;
 * nessuna regola sui percorsi WordPress, che il sito non ha.
 */

// Letto a ogni richiesta, come la sitemap: `SITE_URL` è quello dell'avvio, non della compilazione.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/admin' }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
