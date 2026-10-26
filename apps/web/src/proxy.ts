import { NextResponse, type NextRequest } from 'next/server';
import { FEED_ITEMS, renderFeed } from './lib/feed';
import { asNextParams, isPreviewPath } from './lib/previewPath';
import { siteUrl } from './lib/site';

/**
 * Ciò che si risponde prima di rendere una pagina.
 *
 * - **Redirect** (ADR-003 §3: sono dati, li serve l'applicazione e non il proxy):
 *   si chiede all'API se per il percorso vale una regola. Così il codice di stato
 *   è quello registrato — 301 — e non il 308 che Next usa per i propri
 *   reindirizzamenti (criteri 1E-9 e 1E-13).
 * - **Feed RSS** (`/feed/`, `/category/<slug>/feed/`) e il **302** di
 *   `/wp-sitemap.xml` verso `/sitemap.xml`: indirizzi di sistema della sorgente,
 *   non visivi, che non meritano una pagina propria.
 */

const API_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3002'
).replace(/\/$/, '');

interface Rule {
  readonly targetPath: string;
  readonly statusCode: number;
}

async function api<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    // Servizio non raggiungibile: la pagina lo dirà; un redirect mancato non deve bloccarla.
    return null;
  }
}

async function feed(prefix: string): Promise<NextResponse | null> {
  const settings = (await api<Record<string, unknown>>('/public/settings')) ?? {};
  const siteTitle = typeof settings['site.title'] === 'string' ? settings['site.title'] : '';
  const siteDescription =
    typeof settings['site.description'] === 'string' ? settings['site.description'] : '';
  let termIds = '';
  let title = siteTitle;
  if (prefix !== '/') {
    const term = await api<{ term: { id: string; name: string } }>(
      `/public/terms?path=${encodeURIComponent(prefix)}`,
    );
    if (!term) return null;
    termIds = term.term.id;
    title = `${term.term.name} - ${siteTitle}`;
  }
  const posts = await api<{
    items: { title: string; path: string; publishedAt: string | null; summary: string | null }[];
  }>(`/public/posts?termIds=${termIds}&perPage=${FEED_ITEMS}`);
  if (!posts) return null;
  return new NextResponse(
    renderFeed({
      siteUrl: siteUrl(),
      title,
      description: siteDescription,
      path: prefix,
      items: posts.items,
    }),
    { headers: { 'content-type': 'application/rss+xml; charset=UTF-8' } },
  );
}

/** L'anteprima delle bozze (S16): mai indicizzata né conservata, e senza ricerca di redirect. */
function previewResponse(): NextResponse {
  const response = NextResponse.next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (isPreviewPath(asNextParams(path))) return previewResponse();

  if (path === '/wp-sitemap.xml') {
    return NextResponse.redirect(new URL('/sitemap.xml', request.nextUrl.origin), 302);
  }

  const feedPrefix = /^(\/|\/category\/[^/]+\/)feed\/$/.exec(path)?.[1];
  if (feedPrefix) {
    const response = await feed(feedPrefix);
    if (response) return response;
  }

  const rule = await api<Rule>(`/public/redirect?path=${encodeURIComponent(path)}`);
  if (!rule) return NextResponse.next();
  const target = rule.targetPath.startsWith('/')
    ? new URL(rule.targetPath, request.nextUrl.origin)
    : new URL(rule.targetPath);
  return NextResponse.redirect(target, rule.statusCode);
}

export const config = {
  // Non i file del sito né quelli dei media: solo i percorsi che potrebbero essere pagine.
  matcher: ['/((?!_next/|media/|fonts/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)'],
};
