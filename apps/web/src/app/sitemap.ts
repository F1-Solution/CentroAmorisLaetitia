import type { MetadataRoute } from 'next';
import { getSitemap } from '../lib/api';

/**
 * Mappa del sito dalla lettura pubblica (DR-104): contenuti pubblicati non esclusi
 * dai motori e categorie. Il confronto con la struttura della sorgente è della
 * `1E-W7` (`visual-regression-plan.md` §9).
 */

export const dynamic = 'force-dynamic';

const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { entries } = await getSitemap();
  return entries.map((entry) => ({
    url: `${SITE_URL}${entry.path}`,
    lastModified: entry.updatedAt,
  }));
}
