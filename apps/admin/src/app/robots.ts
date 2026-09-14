import type { MetadataRoute } from 'next';

/** Nessun crawler, in nessun caso (ADR-008 §3.3 regola 2). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
