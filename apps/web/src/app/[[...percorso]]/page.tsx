import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { SiteShell } from '../../components/SiteShell';
import { ArchiveView, ContentView, DocumentView } from '../../components/Views';
import {
  getContent,
  getDocument,
  getPosts,
  getSettings,
  getTerm,
  settingString,
  type PostPage,
  type PublicContent,
  type PublicDocument,
  type Term,
} from '../../lib/api';
import type { MediaMap } from '@amoris/blocks';

/**
 * Ogni percorso del sito pubblico passa di qui (`1E-W4`), resa sul server a ogni
 * richiesta (DR-105). L'ordine è quello della sorgente: archivio di categoria,
 * pagina di un documento, contenuto; altrimenti 404. I redirect li ha già serviti
 * `src/proxy.ts`, prima di arrivare qui.
 */

export const dynamic = 'force-dynamic';

/**
 * Articoli per pagina negli archivi di categoria: è un'opzione del tema
 * (`et_divi.divi_catnum_posts = 6`), distinta da `content.posts_per_page` (10),
 * che vale per il blocco di riserva della home di WordPress.
 */
const CATEGORY_POSTS_PER_PAGE = 6;

type Resolved =
  | {
      kind: 'archive';
      term: Term & { description: string | null };
      seoTitle: string;
      robots: string;
      page: number;
      posts: PostPage;
    }
  | { kind: 'document'; document: PublicDocument; media: MediaMap }
  | { kind: 'content'; data: PublicContent };

interface Params {
  readonly params: Promise<{ percorso?: string[] }>;
}

function pathOf(segments: readonly string[] | undefined): string {
  if (!segments || segments.length === 0) return '/';
  return `/${segments.map((segment) => decodeURIComponent(segment)).join('/')}/`;
}

/** Una sola risoluzione per richiesta, condivisa fra metadati e pagina. */
const resolve = cache(async (path: string): Promise<Resolved | null> => {
  const archive = /^(\/category\/[^/]+\/)(?:page\/(\d+)\/)?$/.exec(path);
  if (archive?.[1]) {
    const found = await getTerm(archive[1]);
    const page = Number(archive[2] ?? '1');
    if (found && page >= 1) {
      const posts = await getPosts([found.term.id], page, CATEGORY_POSTS_PER_PAGE);
      if (posts && (page === 1 || posts.items.length > 0)) {
        return {
          kind: 'archive',
          term: found.term,
          seoTitle: found.seo.title,
          robots: found.seo.robots,
          page,
          posts,
        };
      }
    }
    return null;
  }

  const download = /^\/download\/([^/]+)\/$/.exec(path);
  if (download?.[1]) {
    const found = await getDocument(download[1]);
    return found ? { kind: 'document', document: found.document, media: found.media } : null;
  }

  const data = await getContent(path);
  return data ? { kind: 'content', data } : null;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const path = pathOf((await params).percorso);
  const resolved = await resolve(path);
  const siteTitle = settingString(await getSettings(), 'site.title');
  if (!resolved) return { title: `404 Non trovato | ${siteTitle}` };

  if (resolved.kind === 'archive') {
    // Suffisso di paginazione in italiano (DR-040: la sorgente scrive « - Page 2»).
    const suffix = resolved.page > 1 ? ` - Pagina ${resolved.page}` : '';
    return {
      title: `${resolved.seoTitle}${suffix}`,
      robots: resolved.robots,
      alternates: { canonical: path },
    };
  }
  if (resolved.kind === 'document') {
    return { title: `${resolved.document.title} - ${siteTitle}`, alternates: { canonical: path } };
  }

  const { seo } = resolved.data;
  return {
    title: seo.title,
    ...(seo.description ? { description: seo.description } : {}),
    robots: seo.robots,
    alternates: { canonical: seo.canonicalPath },
    openGraph: {
      title: seo.ogTitle,
      ...(seo.ogDescription ? { description: seo.ogDescription } : {}),
      type: seo.ogType === 'website' ? 'website' : 'article',
      url: seo.canonicalPath,
      siteName: siteTitle,
      locale: 'it_IT',
      ...(seo.ogImagePath ? { images: [seo.ogImagePath] } : {}),
    },
  };
}

export default async function Page({ params }: Params) {
  const path = pathOf((await params).percorso);
  const resolved = await resolve(path);
  if (!resolved) notFound();

  return (
    <SiteShell currentPath={path}>
      {resolved.kind === 'archive' ? (
        <ArchiveView term={resolved.term} posts={resolved.posts} page={resolved.page} />
      ) : resolved.kind === 'document' ? (
        <DocumentView document={resolved.document} media={resolved.media} />
      ) : (
        <ContentView data={resolved.data} />
      )}
    </SiteShell>
  );
}
