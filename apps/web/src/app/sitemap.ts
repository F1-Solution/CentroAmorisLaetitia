import type { MetadataRoute } from 'next';
import { getSitemap } from '../lib/api';
import { siteUrl } from '../lib/site';

/**
 * Mappa del sito dalla lettura pubblica (DR-104): contenuti pubblicati non esclusi
 * dai motori e categorie. Il confronto con la struttura della sorgente è della
 * `1E-W7` (`visual-regression-plan.md` §9).
 */

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { entries } = await getSitemap();
  const base = siteUrl();
  return entries.map((entry) => ({
    url: `${base}${entry.path}`,
    lastModified: entry.updatedAt,
  }));
}
