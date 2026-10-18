import type { Metadata } from 'next';
import { connection } from 'next/server';
import { JsonLd } from '../components/JsonLd';
import { SiteShell } from '../components/SiteShell';
import { NotFoundView } from '../components/Views';
import { getSettings } from '../lib/api';
import { siteUrl } from '../lib/site';
import { buildGraph, siteFromSettings } from '../lib/structuredData';

/** La pagina 404 del tema, con il codice di stato 404 (`url-matrix.csv`: `/404-url-inesistente/`). */
export const metadata: Metadata = { title: '404 Non trovato | Centro Amoris Laetitia' };

export default async function NotFound() {
  // Resa alla richiesta come ogni pagina (DR-105): le impostazioni non si leggono alla compilazione.
  await connection();
  // DR-187: WebPage senza nome; il percorso qui non è noto, gli identificativi restano relativi.
  const graph = buildGraph(siteFromSettings(await getSettings(), siteUrl()), {
    kind: 'notFound',
    path: null,
  });
  return (
    <SiteShell currentPath="">
      <JsonLd graph={graph} />
      <NotFoundView />
    </SiteShell>
  );
}
