import type { Metadata } from 'next';
import { SiteShell } from '../components/SiteShell';
import { NotFoundView } from '../components/Views';

/** La pagina 404 del tema, con il codice di stato 404 (`url-matrix.csv`: `/404-url-inesistente/`). */
export const metadata: Metadata = { title: '404 Non trovato | Centro Amoris Laetitia' };

export default function NotFound() {
  return (
    <SiteShell currentPath="">
      <NotFoundView />
    </SiteShell>
  );
}
